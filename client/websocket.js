/// TO REPLACE LARAVEL ECHO
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

window.websocket = new WebSocketClient(`${VITE_APP_SOCKETIO_SCHEME}://${VITE_APP_SOCKETIO_HOST}:${VITE_APP_SOCKETIO_PORT}`);