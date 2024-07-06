<?php
// app/Broadcasting/CustomHttpBroadcaster.php

namespace App\Broadcasting;

use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Illuminate\Contracts\Broadcasting\Broadcaster as BroadcasterContract;
use Illuminate\Support\Facades\Http;

///here is the implementation that laravel will uses to dispatch the event.
///when you call any event and dispatch, the event will be sent to this class
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
    ///you can do awesome things with this little example..
    ///in this case i am using only to send the event to the url that i have set in the realtime api
    ///but you can do a lot of things with this kind of implementantion
    ///DISCLAIMER: laravel docs its not soo easily when you need to do some tricks like this. This cost me two glasses of coke and a lot of time to figure out how to do this.
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
