///06/07/2024 03:58 PM
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
