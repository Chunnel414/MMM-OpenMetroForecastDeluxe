/*********************************
  Node Helper for MMM-OpenMeteoForecastDeluxe.

  This helper is responsible for pulling daily forecast data from the 
  Open-Meteo API, which provides a free, key-less endpoint.
*********************************/

var NodeHelper = require("node_helper");
var moment = require("moment");
var needle = require("needle"); 

module.exports = NodeHelper.create({

    start: function() {
        console.log("Starting node_helper for module [MMM-OpenMeteoForecastDeluxe]");
    },

    socketNotificationReceived: function(notification, payload) {
        
        // --- 1. CLIENT LOG HANDLER (Must be separate from main fetch logic) ---
        if (notification === "CLIENT_LOG") {
            // Check instanceId is only necessary if we had multiple instances
            console.log(`[CLIENT LOG] ${payload.message}`);
            return; // Stop processing after logging client message
        }

        // --- 2. MAIN FETCH HANDLER ---
        if (notification === "OPENMETEO_FORECAST_GET") {
            console.log("[MMM-OpenMeteoForecastDeluxe] " + notification );
            var self = this;

            if (payload.latitude == null || payload.longitude == null) {
                console.log("[MMM-OpenMeteoForecastDeluxe] ** ERROR ** Latitude or Longitude not provided.");
                return; 
            } 

            // FIX: The URL is now correct.
            var apiUrl = `https://api.open-meteo.com/v1/forecast?` +
                `latitude=${payload.latitude}` +
                `&longitude=${payload.longitude}` +
                `&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,winddirection_10m` +
                `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,windspeed_10m,weathercode` + 
                `&daily=temperature_2m_max,temperature_2m_min,weathercode,windspeed_10m_max,winddirection_10m_dominant,precipitation_probability_max,precipitation_sum,sunrise,sunset` +
                `&timeformat=unixtime` +
                `&timezone=auto` +
                `&forecast_days=${payload.maxDailies}`;

            console.log("[MMM-OpenMeteoForecastDeluxe] Getting data from: " + apiUrl);

            const MAX_RETRIES = 3;
            let currentRetry = 0;

            const fetchData = async () => {
                while (currentRetry < MAX_RETRIES) {
                    try {
                        const resp = await fetch(apiUrl); 

                        if (!resp.ok) {
                            throw new Error(`HTTP Error! Status: ${resp.status}`);
                        }

                        const json = await resp.json();

                        json.instanceId = payload.instanceId;

                        self.sendSocketNotification("OPENMETEO_FORECAST_DATA", json);
                        console.log(`[MMM-OpenMeteoForecastDeluxe] Successfully retrieved data after ${currentRetry} retries.`);
                        return;

                    } catch (error) {
                        currentRetry++;
                        console.warn(`[OMFD] Fetch failed (Attempt ${currentRetry}/${MAX_RETRIES}): ${error.name} - ${error.message}`);
                        
                        if (currentRetry === MAX_RETRIES) {
                            console.error(`[OMFD] ** ERROR ** Failed to fetch weather data after ${MAX_RETRIES} attempts.`);
                            self.sendSocketNotification("OPENMETEO_FETCH_ERROR", { instanceId: payload.instanceId, error: error.message });
                        }
                        await new Promise(resolve => setTimeout(resolve, 120000));
                    }
                }
            };
            
            fetchData();
        }
    }
});
