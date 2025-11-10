/*********************************
  Node Helper for MMM-OpenMeteoForecastDeluxe.

  This helper is responsible for pulling daily forecast data from the 
  Open-Meteo API, which provides a free, key-less endpoint.

  The Open-Meteo API request structure is:
  https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,windspeed_10m_max,winddirection_10m_dominant,precipitation_probability_max,precipitation_sum&timeformat=unixtime&timezone=auto&forecast_days={days}

  We specifically request 'temperature_2m_max' and 'temperature_2m_min' to get 
  the actual air temperature (not apparent/feels-like) for the temperature bars.
*********************************/

var NodeHelper = require("node_helper");
var moment = require("moment");
var needle = require("needle"); // Retained from original structure, though 'fetch' is usually better now.

module.exports = NodeHelper.create({

    start: function() {
        console.log("Starting node_helper for module [MMM-OpenMeteoForecastDeluxe]");
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "OPENMETEO_FORECAST_GET") {
            console.log("[MMM-OpenMeteoForecastDeluxe] " + notification );
            var self = this;

            if (payload.latitude == null || payload.longitude == null) {
                console.log("[MMM-OpenMeteoForecastDeluxe] ** ERROR ** Latitude or Longitude not provided.");
                return; // Stop execution if location is missing
            }

            // We only need the DAILY forecast data for the bars layout.
            // Open-Meteo is key-less, so the endpoint is simple.
            var apiUrl = "https://api.open-meteo.com/v1/forecast?" +
                "latitude=" + payload.latitude +
                "&longitude=" + payload.longitude +
                "&daily=temperature_2m_max,temperature_2m_min,weathercode,windspeed_10m_max,winddirection_10m_dominant,precipitation_probability_max,precipitation_sum,time" +
                "&timeformat=unixtime" +
                "&timezone=auto" +
                "&forecast_days=" + payload.maxDailies; // Use the maxDailies to limit the request size

            // Open-Meteo does not use a 'units' parameter; it defaults to Metric. 
            // We will do all unit conversion in the client-side MMM-OpenMeteoForecastDeluxe.js.
            
            console.log("[MMM-OpenMeteoForecastDeluxe] Getting data from: " + apiUrl);
                
            (async () => {
                try {
                    const resp = await fetch(apiUrl);
                    if (!resp.ok) {
                        throw new Error(`HTTP error! status: ${resp.status}`);
                    }
                    const json = await resp.json();
                    
                    // Add instanceId to the payload before sending back
                    json.instanceId = payload.instanceId;

                    // The Open-Meteo daily data is nested under the 'daily' property
                    self.sendSocketNotification("OPENMETEO_FORECAST_DATA", json);
                    console.log("[MMM-OpenMeteoForecastDeluxe] Successfully retrieved and sent Open-Meteo data.");

                } catch (error) {
                    console.error("[MMM-OpenMeteoForecastDeluxe] ** ERROR ** Failed to fetch weather data: " + error);
                    self.sendSocketNotification("OPENMETEO_FETCH_ERROR", { instanceId: payload.instanceId, error: error.message });
                }
            })();
        }
    }
});