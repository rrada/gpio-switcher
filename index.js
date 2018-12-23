var config = require('config');
var io = require('socket.io-client');
var rpio = require('rpio');

// connect to socket
var socket = io.connect('http://volumio.local:3000');

// keeps last event to filter out multiple pushState calls
var lastEvent = "";
var lastEventTime = GetTimestamp();
var stopTimer = null;
var inactivityTimer = null;


// config values
var pin = config.get('Switcher.GPIO.pin');
var pinInit = config.get('Switcher.GPIO.initState');
var onStopTimerLength = config.get('Switcher.Timers.onStop');
var onInactiveTimerLength = config.get('Switcher.Timers.onInactive');

var inactiveEvents = config.get('Switcher.Volumio.inactiveEvents');
var inactiveTime = config.get('Switcher.Volumio.inactiveTime');

// get current state of pin
var pinState = pinInit;

socket.on('connect', function()
{
	//console.log("Client connected");

    socket.emit('getState');

    rpio.open(pin, rpio.OUTPUT, pinInit);
    inactivityTimer = setInterval(InactivityMonitor, onInactiveTimerLength * 1000);
});

socket.on('pushState', function(data)
{
	//console.log(data);
	if (data.status == "play" && data.status != lastEvent)
	{
        // cancel Timer
        if(stopTimer) clearTimeout(stopTimer);

		lastEvent = data.status;
        lastEventTime = GetTimestamp();

		//console.log("volumio >> started playing");
        if (pinState == rpio.HIGH)
        {
            GPIOWrite(pin, rpio.LOW);
        }
	}
	else if (data.status == "stop" && data.status != lastEvent)
	{
		lastEvent = data.status;
        lastEventTime = GetTimestamp();

		//console.log("volumio >> stopped playing");
        stopTimer = setTimeout(GPIOWrite, onStopTimerLength * 1000, pin, rpio.HIGH)
	}
    else if (data.status == 'pause' && data.status != lastEvent)
    {
		lastEvent = data.status;
        lastEventTime = GetTimestamp();
    }
});

socket.on('disconnect', function()
{
	//console.log("client disconnect");
});



function InactivityMonitor()
{
    if (inactiveEvents.indexOf(lastEvent) > -1)
    {
        // inactivity not long enough - bail out
        if ((GetTimestamp() - lastEventTime) < inactiveTime) return;

        //! if GPIO pin is enabled
        if (pinState == rpio.LOW)
        {
            GPIOWrite(pin, rpio.HIGH);
            //console.log('switching off by inactivity');
        }

        //console.log("Volumio has been inactive for " + onInactiveTimerLength);
    }
}

function GPIORead(pin)
{
    //console.log('Pin is currently ' + (rpio.read(pin) ? 'high' : 'low'));
    return rpio.read(pin);
}

function GPIOWrite(pin, value)
{
    rpio.write(pin, value);
    pinState = value;
    //console.log('Pin is currently ' + (rpio.read(pin) ? 'high' : 'low'));
}

function GetTimestamp()
{
    return Math.floor(Date.now() / 1000);
}
