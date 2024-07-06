<?php

// app/Providers/BroadcastServiceProvider.php

namespace App\Providers;

use App\Broadcasting\CustomHttpBroadcaster;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;

class BroadcastServiceProvider extends ServiceProvider
{
    public function boot()
    {
        ///here you are extending the new provider to broadcast
        Broadcast::extend('custom_http', function ($app, $config) {
            return new CustomHttpBroadcaster($config);
        });
    }
}
