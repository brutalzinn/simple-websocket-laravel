# Simple Websocket Communication!

## IN DEVELOPMENT WITH NEW CRAZY CHANGE

EXIT LARAVEL ECHO WITH REVERB AND SOME OF ITS VARIANTS. Take control of your time. That is the glorious purpose.
(little joke with Loki, the true God of Marvel)


![Loki](https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmU5YWFxdG03NXFkM3ljdTR6cmloOXg4cnN0eDM2NGFvMjlkczE1YiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/VlrRiZAur3jylN2XKT/giphy.gif)


## Why this repo?

When using frameworks like Laravel, it can be challenging to set up a simple WebSocket server that works with Laravel's event broadcaster. This project is the result of my struggle to understand how to use WebSocket without Redis or any costly services, which many Medium or StackOverflow articles suggest. This guide documents my experience over five hours on a Friday, aiming to help others achieve the same.

# Why new API?

Using laravel reverb you already running other web service. This repo contains all you need to run your managed api to handle websockets and get all control of data in bidirectional way. This api uses nodejs with express and websocket server to handle publish and subscribe routes and to provide a websocket long polling connection that you can use like bidirectional way or anything other thinks you need. And contains a small websocket implementantion with js that you can uses at your frontend applications. Or you can uses  as example what you can do in your stack.

## Context

First, let me introduce what this repo can help you with. This repo contains two folders: `client` and `laravel`.

- **Client Folder**: Contains everything you need on the client side to connect with WebSocket.
- **Laravel Folder**: Contains files you need to integrate into your Laravel project.

My use case uses Laravel 11 and pure HTML with JavaScript for the frontend. Remember, this solution can be applied to any technology stack you use. The client folder contains a JavaScript implementation of WebSocket using a class called `WebSocketClient`. I modeled this using a structure similar to Socket.IO channels and observers. This approach can be useful if you want to move away from Laravel Echo with Reverb

Second, understand that this repo is just a guide on how to use WebSocket with Laravel and its events system in sync.

No more words. Let's start!


## Requirements

-  PHP 8+
-  NodeJS 14+
-  Laravel 11

You can uses the Dockerfile that contains the api. This image has all you need to run the api without install
none dependencies

## Setup

### 1. Setup Laravel Project

1. **Install Laravel**: Follow the official [Laravel installation guide](https://laravel.com/docs/10.x/installation) to set up your Laravel 11 project.

2. **Add the Custom Broadcaster**

Create the custom broadcaster class:

```php
// app/Broadcasting/CustomHttpBroadcaster.php

namespace App\Broadcasting;

use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Illuminate\Contracts\Broadcasting\Broadcaster as BroadcasterContract;
use Illuminate\Support\Facades\Http;

class CustomHttpBroadcaster extends Broadcaster implements BroadcasterContract
{
    protected $publishUrl;

    public function __construct($config)
    {
        $this->publishUrl = $config['publish_url'];
    }

    public function auth($request)
    {
        return true; // Handle authentication if needed
    }

    public function validAuthenticationResponse($request, $result)
    {
        return true; // Handle valid authentication response if needed
    }

    public function broadcast(array $channels, $event, array $payload = [])
    {
        foreach ($this->formatChannels($channels) as $channel) {
            Http::post($this->publishUrl, [
                'channel' => $channel,
                'event' => $event,
                'data' => $payload,
            ]);
        }
    }
}
```

Register the custom broadcaster:

```php
// app/Providers/BroadcastServiceProvider.php

namespace App\Providers;

use App\Broadcasting\CustomHttpBroadcaster;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;

class BroadcastServiceProvider extends ServiceProvider
{
    public function boot()
    {
        Broadcast::routes();

        require base_path('routes/channels.php');

        Broadcast::extend('custom_http', function ($app, $config) {
            return new CustomHttpBroadcaster($config);
        });
    }
}
```

Configure the broadcaster in `config/broadcasting.php`:

```php
// config/broadcasting.php

return [

    'default' => env('BROADCAST_CONNECTION', 'null'),

    'connections' => [

        'pusher' => [
            'driver' => 'pusher',
            'key' => env('PUSHER_APP_KEY'),
            'secret' => env('PUSHER_APP_SECRET'),
            'app_id' => env('PUSHER_APP_ID'),
            'options' => [
                'cluster' => env('PUSHER_APP_CLUSTER'),
                'useTLS' => true,
            ],
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => 'default',
        ],

        'log' => [
            'driver' => 'log',
        ],

        'null' => [
            'driver' => 'null',
        ],
        ///add this line
        'custom_http' => [
            'driver' => 'custom_http',
            'publish_url' => env('CUSTOM_HTTP_PUBLISH_URL'),
        ],

    ],

];
```

Set the environment variables in `.env`:

```
CUSTOM_HTTP_PUBLISH_URL=http://localhost:3000/publish
BROADCAST_CONNECTION=custom_http
```

### 2. Set Up NodeJS WebSocket Server

Create a NodeJS project:

```sh
$ mkdir websocket-server
$ cd websocket-server
$ npm init -y
$ npm install express ws axios
```

Create the WebSocket server:
```js
///websocket-server/server.js
const express = require('express');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(bodyParser.json());

const wss = new WebSocket.Server({ noServer: true });

let subscriptions = {};
let clients = {};

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message);
        const { action, channel, event, data, callbackUrl, authorizationHeader } = parsedMessage;

        if (action === 'subscribe') {
            if (!clients[channel]) {
                clients[channel] = {};
            }
            if (!clients[channel][event]) {
                clients[channel][event] = [];
            }
            clients[channel][event].push(ws);

            if (callbackUrl && authorizationHeader) {
                if (!subscriptions[channel]) {
                    subscriptions[channel] = {};
                }
                if (!subscriptions[channel][event]) {
                    subscriptions[channel][event] = [];
                }
                subscriptions[channel][event].push({ callbackUrl, authorizationHeader });
            }
        } else if (action === 'publish') {
            const subscribers = subscriptions[channel]?.[event] || [];
            const connectedClients = clients[channel]?.[event] || [];

            subscribers.forEach(async ({ callbackUrl, authorizationHeader }) => {
                try {
                    await axios.post(callbackUrl, data, {
                        headers: {
                            Authorization: authorizationHeader
                        }
                    });
                } catch (error) {
                    console.error(`Error posting to ${callbackUrl}: ${error.message}`);
                }
            });

            connectedClients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ channel, event, data }));
                }
            });
        }
    });

    ws.on('close', () => {
        for (const channel in clients) {
            for (const event in clients[channel]) {
                clients[channel][event] = clients[channel][event].filter(client => client !== ws);
            }
        }
    });
});

app.post('/publish', (req, res) => {
    const { channel, event, data } = req.body;
    const subscribers = subscriptions[channel]?.[event] || [];
    const connectedClients = clients[channel]?.[event] || [];

    subscribers.forEach(async ({ callbackUrl, authorizationHeader }) => {
        try {
            await axios.post(callbackUrl, data, {
                headers: {
                    Authorization: authorizationHeader
                }
            });
        } catch (error) {
            console.error(`Error posting to ${callbackUrl}: ${error.message}`);
        }
    });

    connectedClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ channel, event, data }));
        }
    });

    res.send('Event published');
});

app.post('/subscribe', (req, res) => {
    const { channel, event, callbackUrl, authorizationHeader } = req.body;

    if (!subscriptions[channel]) {
        subscriptions[channel] = {};
    }
    if (!subscriptions[channel][event]) {
        subscriptions[channel][event] = [];
    }
    subscriptions[channel][event].push({ callbackUrl, authorizationHeader });
    res.send('Subscribed to event');
});

const server = app.listen(PORT, () => {
    console.log(`Listening on port {PORT}`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
```

### 3. Client Implementation

Create the client-side WebSocket implementation:

```html
<!-- client/index.html -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebSocket Client</title>
    <script>
        class WebSocketClient {
    constructor(url, reconnectInterval = 5000) {
        this.url = url;
        this.socket = null;
        this.channels = {};
        this.messageQueue = [];
        this.isConnected = false;
        this.reconnectInterval = reconnectInterval;
        this.reconnectTimeout = null;
        this.connect();
    }

    connect() {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            console.log('Connected to WebSocket server');
            this.isConnected = true;
            while (this.messageQueue.length > 0) {
                this.socket.send(this.messageQueue.shift());
            }
            for (const channel in this.channels) {
                for (const event in this.channels[channel]) {
                    this.send(JSON.stringify({
                        action: 'subscribe',
                        channel,
                        event,
                    }));
                }
            }
        };

        this.socket.onmessage = (message) => {
            const data = JSON.parse(message.data);
            const { event, data: eventData, channel } = data;

            if (this.channels[channel] && this.channels[channel][event]) {
                this.channels[channel][event].forEach((callback) => callback(eventData));
            }
        };

        this.socket.onclose = () => {
            console.log('Disconnected from WebSocket server');
            this.isConnected = false;
            this.reconnect();
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.socket.close();
        };
    }

    reconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        this.reconnectTimeout = setTimeout(() => {
            console.log('Attempting to reconnect to WebSocket server');
            this.connect();
        }, this.reconnectInterval);
    }

    send(message) {
        if (this.isConnected) {
            this.socket.send(message);
        } else {
            this.messageQueue.push(message);
        }
    }

    subscribe(channel, event) {
        if (!this.channels[channel]) {
            this.channels[channel] = {};
        }
        if (!this.channels[channel][event]) {
            this.channels[channel][event] = [];
        }

        this.send(JSON.stringify({
            action: 'subscribe',
            channel,
            event,
        }));
    }

    publish(channel, event, data) {
        this.send(JSON.stringify({
            action: 'publish',
            channel,
            event,
            data,
        }));
    }

    on(channel, event, callback) {
        if (!this.channels[channel]) {
            this.channels[channel] = {};
        }
        if (!this.channels[channel][event]) {
            this.channels[channel][event] = [];
        }
        this.channels[channel][event].push(callback);
    }

    listen(channel, event, callback) {
        this.on(channel, event, callback);
        this.subscribe(channel, event);
    }

    subscribeWithCallbackUrl(channel, event, callbackUrl, authorizationHeader) {
        this.send(JSON.stringify({
            action: 'subscribe',
            channel,
            event,
            callbackUrl,
            authorizationHeader,
        }));
    }
    channel(channelName) {
        return {
            listen: (eventName, callback) => {
                this.listen(channelName, eventName, callback);
                return this;
            },
            subscribeWithCallback: (eventName, callbackUrl, authorizationHeader) => {
                this.subscribeWithCallbackUrl(channelName, eventName, callbackUrl, authorizationHeader);
                return this;
            }
        };
    }
}

        const wsClient = new WebSocketClient('ws://localhost:3000/?clientId=myUniqueId');

        // Example usage 1:
        wsClient.listen('myChannel', 'myEvent', (data) => {
            console.log('Received event data:', data);
        });

        // Example usage 2 (like socket io or Laravel Echo):
        wsClient.channel('myChannel')
        .listen('myEvent', (data) => {
            console.log('Received event data:', data);
        });

            ///with this, you can handle messages again at laravel if you need and you dont need to setup a listener at backend server. A url callback is some less pain. Princily if you uses apache

        wsClient.subscribe('myChannel', 'myEvent', 'http://localhost:3000/subscribe');

        // To publish an event:
        //you can handle thi
         wsClient.publish('myChannel', 'myEvent', { key: 'value' });
    </script>
</head>
<body>
    <h1>WebSocket Client</h1>
</body>
</html>
```

## How to Use

1. **Laravel Setup**:
   - Follow the instructions in the `laravel` folder to set up the custom broadcaster.
   - Ensure environment variables are set correctly.

2. **WebSocket Server**:
   - Run the WebSocket server by navigating to the `websocket-server` folder and running `node server.js`.

3. **Client Setup**:


   - Open the `index.html` file in your browser to see the WebSocket client in action.

## Conclusion

This guide helps you set up a WebSocket server that works seamlessly with Laravel's event broadcasting system, without the need for Redis or other third-party services. By following the steps outlined, you can achieve real-time communication in your Laravel applications using a custom broadcaster and a simple NodeJS WebSocket server.

Feel free to contribute to this project or reach out if you have any questions. Happy coding!

---

This README provides a comprehensive guide, including setup instructions, code examples, and explanations, making it easier for other developers to understand and use your project. And for me too. I feel i will be back at this repo after some years and for myself future : please, dont overthink about this again.
