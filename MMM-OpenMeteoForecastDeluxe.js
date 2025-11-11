/*********************************

  MagicMirror² Module:
  MMM-OpenMeteoForecastDeluxe (FULL DIAGNOSTIC LOGGING)

*********************************/

Module.register("MMM-OpenMeteoForecastDeluxe", {

    requiresVersion: "2.2.0",

    defaults: {
        latitude: null, // REQUIRED
        longitude: null, // REQUIRED
        updateInterval: 60, // minutes
        updateFadeSpeed: 500, // milliseconds
        requestDelay: 0,
        units: config.units,
        language: "en",
        colored: true,
        highColor: '#F8DD70',
        lowColor: '#6FC4F5',
        relativeColors: false,
        showCurrentConditions: true,
        showExtraCurrentConditions: true,
        showSummary: true, 
        hourlyForecastHeaderText: "",
        showForecastTableColumnHeaderIcons: true,
        showHourlyForecast: true,
        hourlyForecastLayout: "tiled", 
        hourlyForecastInterval: 3,
        maxHourliesToShow: 3,
        dailyForecastHeaderText: "",
        showDailyForecast: true,
        dailyForecastLayout: "bars", 
        maxDailiesToShow: 7,
        ignoreToday: false,
        showDailyLow: true,
        showDailyHiLowSeparator: true,
        showDayAsTodayInDailyForecast: false,
        showDayAsTomorrowInDailyForecast: false,
        showFeelsLike: true,
        showPrecipitationProbability: true,
        showPrecipitationSeparator: true,
        showPrecipitationAmount: true,
        showWindSpeed: true,
        showWindDirection: true,
        showWindGust: true,
        iconset: "1c",
        mainIconset: "1c",
        useAnimatedIcons: false, 
        animateMainIconOnly: false, 
        showInlineIcons: true,
        mainIconSize: 100,
        forecastTiledIconSize: 70,
        forecastTableIconSize: 30,
        showAttribution: true,
        
        // Unit/Label configuration (simplified for Open-Meteo's metric base)
        label_temp_i: "°F",
        label_temp_m: "°C",
        label_maximum: "max ",
        label_high: "H ",
        label_low: "L ",
        label_hi_lo_separator: " / ",
        label_feels_like: "Feels like ",
        label_timeFormat: "h a",
        label_days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        label_today: "Today",
        label_tomorrow: "Tomorrow",
        label_ordinals: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"],
        label_rain_i: " in",
        label_rain_m: " mm",
        label_snow_i: " in",
        label_snow_m: " mm",
        label_wind_i: " mph",
        label_wind_m: " m/s",
        label_gust_i: " mph",
        label_gust_m: " m/s",
        label_no_precip: "0%",
        label_no_wind: "0 mph",
        label_precip_separator: " ",
        label_gust_wrapper_prefix: " (",
        label_gust_wrapper_suffix: ")",
        dp_precip_leading_zero: false,
        dp_wind_leading_zero: true,
        dp_rain_i: 2,
        dp_rain_m: 0,
        dp_snow_i: 2,
        dp_snow_m: 0,
        dp_temp_i: 0,
        dp_temp_m: 0,
        dp_wind_i: 0,
        dp_wind_m: 0,
        moduleTimestampIdPrefix: "OPENMETEO_FORECAST_TIMESTAMP_",
    },

    validUnits: ["imperial", "metric"],
    validHourlyLayouts: ["tiled", "table"],
    validDailyLayouts: ["tiled", "table", "bars"],

    getScripts: function() {
        return ["moment.js", this.file("skycons.js"), this.file("MMM-OpenMeteoForecastDeluxe.js")];
    },

    getStyles: function() {
        return ["MMM-OpenMeteoForecastDeluxe.css"];
    },

    getTemplate: function() {
        return "MMM-OpenMeteoForecastDeluxe.njk"; 
    },

    getTemplateData: function() {
        this.logToTerminal("[OMFD-TPL] START getTemplateData.");
		
		// FIX: Ensures iconsets is initialized before accessing it.
        if (!this.iconsets) {
            this.iconsets = this.getIconsets();
            this.logToTerminal("[OMFD-TPL] Initialized this.iconsets inside getTemplateData.");
        }
		
        const data = {
            phrases: this.phrases,
            loading: this.formattedWeatherData == null ? true : false,
            config: this.config,
            forecast: this.formattedWeatherData,
            inlineIcons: {
                // Inline icons logic calls generateIconSrc
                rain: this.generateIconSrc("i-rain"),
                snow: this.generateIconSrc("i-snow"),
                wind: this.generateIconSrc("i-wind")
            },
            animatedIconSizes: {
                main: this.config.mainIconSize,
                forecast: (this.config.hourlyForecastLayout == "tiled" || this.config.dailyForecastLayout == "tiled") ? this.config.forecastTiledIconSize : this.config.forecastTableIconSize
            },
            moduleTimestampIdPrefix: this.config.moduleTimestampIdPrefix,
            identifier: this.identifier,
            timeStamp: this.dataRefreshTimeStamp
        };
        this.logToTerminal("[OMFD-TPL] END getTemplateData. Returning data object.");
        return data;
    },

    start: function() {
        Log.info("Starting module: " + this.name);
        this.logToTerminal("[OMFD-START] Module starting initialization.");

        this.weatherData = null;
        this.iconIdCounter = 0;
        this.formattedWeatherData = null;
        this.animatedIconDrawTimer = null;
        this.iconsets = this.getIconsets(); 
        
        // FIX: Define 'phrases' early to prevent crash in getTemplateData
        this.phrases = {
			loading: this.translate("LOADING")
		};
        this.logToTerminal(`[OMFD-START] Phrases defined. Units: ${this.config.units}`);


        // ... (Sanitization blocks)

        // Start data poll
        var self = this;
        setTimeout(function() {
            self.getData();
            setInterval(function() {
                self.getData();
            }, self.config.updateInterval * 60 * 1000); // convert to milliseconds
        }, this.config.requestDelay);

        this.logToTerminal("[OMFD-START] Module initialization complete. Request scheduled.");
        Log.info("Done starting module: " + this.name);
    },

    getData: function() {
        this.logToTerminal("[OMFD-DATA] Sending API request.");
        this.sendSocketNotification("OPENMETEO_FORECAST_GET", {
            latitude: this.config.latitude,
            longitude: this.config.longitude,
            instanceId: this.identifier,
            maxDailies: this.config.maxDailiesToShow + 1 
        });
    },

    socketNotificationReceived: function(notification, payload) {
        // FIX: LOG BRIDGE - Add handler for client-side logging
        if (notification === "CLIENT_LOG") {
            // Note: node_helper should handle printing this to the terminal
            return; 
        }

        if (notification === "OPENMETEO_FORECAST_DATA" && payload.instanceId === this.identifier) {
            
            this.logToTerminal(`[OMFD-SOCKET] Data received. Starting processing.`);
            
            // Process weather data
            this.dataRefreshTimeStamp = moment().format("x");
            this.weatherData = payload;
            
            this.formattedWeatherData = this.processWeatherData();
			
			this.logToTerminal("[OMFD-SOCKET] PROCESS DATA COMPLETE. Calling updateDom.");
			
            this.updateDom(this.config.updateFadeSpeed);
            
            // ... (animated icon logic)
        }
    },

    /*
      This is the core function for processing Open-Meteo's parallel arrays and calculating bar properties.
    */
    processWeatherData: function() {
        this.logToTerminal("[OMFD-PROCESS] START processWeatherData.");
        
        const rawDaily = this.weatherData.daily;
        const rawHourly = this.weatherData.hourly;
        const currentHour = moment().hour();
        
        if (!rawDaily || !rawHourly) {
			this.logToTerminal("[OMFD-PROCESS] FATAL: Missing rawDaily or rawHourly array!");
			return null;
		}
		const hoursData = this.transposeDataMatrix(rawHourly);
        this.logToTerminal("[OMFD-PROCESS] Data transposed successfully.");

        // ------------------ Daily Forecast Processing ------------------
        var dailies = [];
        var minTempGlobal = Number.MAX_VALUE;
        var maxTempGlobal = -Number.MAX_VALUE;
        this.logToTerminal(`[OMFD-PROCESS] Starting global temperature loop (${rawDaily.time.length} days).`);


        // 1. Find the Absolute Min/Max Temperature over the entire forecast range
        if (rawDaily.time.length === 0) {
			this.logToTerminal("[OMFD-PROCESS] FATAL: rawDaily.time array is empty!");
			return null;
		}
	
		for (let i = 0; i < rawDaily.time.length; i++) {
            // Read temperature values, ensuring they are numbers (defaulting to a safe range if needed)
            const minTemp = this.getTemp(rawDaily.temperature_2m_min[i], "C");
            const maxTemp = this.getTemp(rawDaily.temperature_2m_max[i], "C");
            
            // Safety Check: Only update global min/max if the fetched temperature is a valid number
            if (typeof minTemp === 'number' && !isNaN(minTemp)) {
                minTempGlobal = Math.min(minTempGlobal, minTemp);
            }
            if (typeof maxTemp === 'number' && !isNaN(maxTemp)) {
                maxTempGlobal = Math.max(maxTempGlobal, maxTemp);
            }
        }
        
        this.logToTerminal(`[OMFD-PROCESS] Global Temp Range FINAL: ${minTempGlobal}degC to ${maxTempGlobal}degC`);

        // 2. Build the daily forecast objects
        for (let i = 0; i < Math.min(rawDaily.time.length, this.config.maxDailiesToShow); i++) {
            
            // Skip today if configured to ignore
            if (i === 0 && this.config.ignoreToday) continue;
            
            this.logToTerminal(`[OMFD-PROCESS] START dailyForecastItemFactory for index: ${i}`);

            let dailyItem = this.dailyForecastItemFactory(rawDaily, i, minTempGlobal, maxGlobal);
            dailies.push(dailyItem);
            
            this.logToTerminal(`[OMFD-PROCESS] END dailyForecastItemFactory for index: ${i}`);
        }
        this.logToTerminal("[OMFD-PROCESS] Daily forecast array creation successful.");

        // ... (Hourly and Current Conditions processing blocks)
        
        this.logToTerminal("[OMFD-PROCESS] All processing finished. Building return object.");
        // ... (return object block)
        
        return {
            // ... (return object content)
            "currently": {
                // ... (current conditions content)
            },
            "summary": "Powered by Open-Meteo",
            "hourly": hourlies,
            "daily": dailies,
        };
    },
    
    // Convert Open-Meteo's parallel arrays into an array of objects for easier iteration
    transposeDataMatrix: function(data) {
        this.logToTerminal("[OMFD-HELPER] START transposeDataMatrix.");
        if (!data || !data.time) return [];
        const result = data.time.map((_, index) => Object.keys(data).reduce((row, key) => {
            return {
                ...row,
                [key]: data[key][index]
            };
        }, {}));
        this.logToTerminal("[OMFD-HELPER] END transposeDataMatrix.");
        return result;
    },

    // ------------------ Daily Forecast Item Factory (The Bars Logic) ------------------

    dailyForecastItemFactory: function(fData, index, minGlobal, maxGlobal) {
        this.logToTerminal(`[OMFD-FACTORY] START Day ${index}`);
        var fItem = new Object();
        
        // 1. CONSTANT DEFINITION AND HELPER CALLS (CRASH ZONE)
        const rawMin = fData.temperature_2m_min[index];
        const rawMax = fData.temperature_2m_max[index];
        const rawWindSpeed = fData.windspeed_10m_max[index];
        const rawWindDirection = fData.winddirection_10m_dominant[index];
        const rawWindGust = fData.windgusts_10m_max[index];
        const rawPrecipProb = fData.precipitation_probability_max[index];
        const rawPrecipAmount = fData.precipitation_sum[index];
        const rawTime = fData.time[index];
        const rawSunrise = fData.sunrise[index];
        const rawSunset = fData.sunset[index];
        const rawWeatherCode = fData.weathercode[index];
        
        this.logToTerminal(`[OMFD-FACTORY] Day ${index}: Raw values read.`);

        const tempMin = this.getTemp(rawMin, "C");
        const tempMax = this.getTemp(rawMax, "C");
        const windSpeed = this.convertWindSpeed(rawWindSpeed, "kmh");
        
        this.logToTerminal(`[OMFD-FACTORY] Day ${index}: TMin/TMax/Wind calculated.`);

        const windDirection = rawWindDirection;
        const windGust = rawWindGust;
        const precipProb = rawPrecipProb;
        const precipAmount = rawPrecipAmount;
        const date = moment.unix(rawTime);

        this.logToTerminal(`[OMFD-FACTORY] Day ${index}: Moment objects created.`);

        // 2. DATE/TIME AND ICON LOGIC
        if (index === 0 && this.config.showDayAsTodayInDailyForecast) fItem.day = this.config.label_today;
        else if (index === 1 && this.config.showDayAsTomorrowInDailyForecast) fItem.day = this.config.label_tomorrow;
        else fItem.day = this.config.label_days[date.format("d")];

        const isDayTime = date.isBetween(moment.unix(rawSunrise), moment.unix(rawSunset));
        if (this.config.useAnimatedIcons && !this.config.animateMainIconOnly) {
            fItem.animatedIconId = this.getAnimatedIconId();
            fItem.animatedIconName = this.convertWeatherCodeToIcon(rawWeatherCode, isDayTime);
        }
        fItem.iconPath = this.generateIconSrc(this.convertWeatherCodeToIcon(rawWeatherCode, isDayTime));
        fItem.sunrise = moment.unix(rawSunrise);
        fItem.sunset = moment.unix(rawSunset);
        
        this.logToTerminal(`[OMFD-FACTORY] Day ${index}: Icon and Date logic complete.`);


        // 3. TEMPERATURE RANGE & BARS LOGIC (CORE REIMPLEMENTATION)
        fItem.tempRange = this.formatHiLowTemperature(tempMax, tempMin);
        
        if (this.config.dailyForecastLayout === "bars") {
            const rangeTotal = maxGlobal - minGlobal;
            
            // CRITICAL CHECK: Prevent division by zero if all temperatures are the same
            if (rangeTotal === 0) { 
                this.logToTerminal(`[OMFD-FACTORY] Day ${index}: CRASH PREVENTED (Range Zero).`);
                fItem.bars = { leftSpacerWidth: 0, barWidth: 100, rightSpacerWidth: 0 };
                fItem.colorStart = this.config.lowColor;
                fItem.colorEnd = this.config.highColor;
            } else {
                // Bar math runs here
                fItem.bars = {
                    min: minGlobal,
                    max: maxGlobal,
                    total: rangeTotal,
                    interval: 100 / rangeTotal, 
                };
                fItem.bars.barWidth = Math.round(fItem.bars.interval * (tempMax - tempMin));
                fItem.bars.leftSpacerWidth = Math.round(fItem.bars.interval * (tempMin - minGlobal));
                fItem.bars.rightSpacerWidth = Math.round(fItem.bars.interval * (maxGlobal - tempMax));

                // Color interpolation
                var colorLo = this.config.lowColor.substring(1);
                var colorHi = this.config.highColor.substring(1);
                var colorStartPos = (tempMin - minGlobal) / rangeTotal;
                var colorEndPos = (tempMax - minGlobal) / rangeTotal;
                fItem.colorStart = '#' + this.interpolateColor(colorLo, colorHi, colorStartPos);
                fItem.colorEnd = '#' + this.interpolateColor(colorLo, colorHi, colorEndPos);
                
                this.logToTerminal(`[OMFD-FACTORY] Day ${index}: Bar math and color interpolated.`);
            }
        }
        
        // 4. PRECIPITATION AND WIND
        fItem.precipitation = this.formatPrecipitation(precipProb, precipAmount, null);
        fItem.wind = (this.formatWind(windSpeed, windDirection, windGust));
        
        this.logToTerminal(`[OMFD-FACTORY] Day ${index}: Factory completed successfully.`);
        return fItem;
    },

    // ... (rest of helper functions including safe getTemp and convertWindSpeed)
    
    // ------------------ Helper and Conversion Functions ------------------
    
    // Converts Celsius to the configured unit (Imperial or Metric)
    getTemp: function(tempInC, inputUnit) {
        if (tempInC == null) return 0; // FIX: Return 0 if input is null/undefined
        this.logToTerminal(`[OMFD-HELPER] getTemp: Input=${tempInC}`);
        if (inputUnit === "C" && this.config.units === "imperial") {
            return (tempInC * 9/5) + 32;
        }
        return tempInC;
    },
    
    // Converts Open-Meteo's m/s wind speed to the configured unit
    convertWindSpeed: function(windInMS, unit) {
        if (windInMS == null) return 0; // FIX: Return 0 if input is null/undefined
        this.logToTerminal(`[OMFD-HELPER] convertWindSpeed: Input=${windInMS}`);
        if (this.config.units === "imperial") {
            return windInMS * 2.23694; 
        }
        return windInMS;
    },
    // ... (rest of helper functions remain the same)
    
    // --- END OF FILE ---

    logToTerminal: function(message) {
        this.sendSocketNotification("CLIENT_LOG", {
            instanceId: this.identifier,
            message: message
        });
    },
});
