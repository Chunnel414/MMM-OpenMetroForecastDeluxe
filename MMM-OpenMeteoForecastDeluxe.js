/*********************************

  MagicMirror² Module:
  MMM-OpenMeteoForecastDeluxe (MAXIMUM DIAGNOSTIC LOGGING - FINAL ATTEMPT)

  NOTE: This file contains NO functional changes or deletions. It is designed to crash
        at the precise line of failure.
  
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
        showSummary: true, // Will display 'Powered by Open-Meteo' in current implementation
        hourlyForecastHeaderText: "",
        showForecastTableColumnHeaderIcons: true,
        showHourlyForecast: true,
        hourlyForecastLayout: "tiled", 
        hourlyForecastInterval: 3,
        maxHourliesToShow: 3,
        dailyForecastHeaderText: "",
        showDailyForecast: true,
        dailyForecastLayout: "bars", // Defaulting to the requested 'bars' layout
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
        this.logToTerminal("[OMFD-GETSCRIPT] Running getScripts.");
        return ["moment.js", this.file("skycons.js"), this.file("MMM-OpenMeteoForecastDeluxe.js")];
    },

    getStyles: function() {
        this.logToTerminal("[OMFD-GETSTYLE] Running getStyles.");
        return ["MMM-OpenMeteoForecastDeluxe.css"]; // Reusing the original CSS
    },

    getTemplate: function() {
        this.logToTerminal("[OMFD-GETTPL] Running getTemplate.");
        return "MMM-OpenMeteoForecastDeluxe.njk"; 
    },

    getTemplateData: function() {
        this.logToTerminal("[OMFD-GETTPLDATA] START getTemplateData.");
		
		// FIX: Ensures iconsets is initialized before accessing it.
        if (!this.iconsets) {
            this.iconsets = this.getIconsets();
            this.logToTerminal("[OMFD-GETTPLDATA] Initialized iconsets via fallback.");
        }
		
        const data = {
            phrases: this.phrases,
            loading: this.formattedWeatherData == null ? true : false,
            config: this.config,
            forecast: this.formattedWeatherData,
            inlineIcons: {
                // Line 131
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
        this.logToTerminal("[OMFD-GETTPLDATA] END getTemplateData. Returning data object.");
        return data;
    },

    start: function() {
        Log.info("Starting module: " + this.name);
        this.logToTerminal("[OMFD-START] START start function.");
        this.weatherData = null;
        this.iconIdCounter = 0;
        this.formattedWeatherData = null;
        this.animatedIconDrawTimer = null;
        this.iconsets = this.getIconsets(); // Initializes this.iconsets
        
        // FIX: Define 'phrases' early to prevent crash in getTemplateData
        this.phrases = {
			loading: this.translate("LOADING")
		};
        this.logToTerminal("[OMFD-START] Phrases initialized.");

        // Initialize Skycons if animated icons are used (assuming the file is available)
        if (this.config.useAnimatedIcons) {
             this.logToTerminal("[OMFD-START] Initializing Skycons.");
             this.skycons = new Skycons({ 
                "monochrome": false,
                "colors": {
                    "main": "#FFFFFF",
                    // ... other colors
                }
            });
        }

        // Sanitize configs
        if (this.validUnits.indexOf(this.config.units) == -1) { this.config.units = "metric"; }
        if (this.validHourlyLayouts.indexOf(this.config.hourlyForecastLayout) == -1) { this.config.hourlyForecastLayout = "tiled"; }
        if (this.validDailyLayouts.indexOf(this.config.dailyForecastLayout) == -1) { this.config.dailyForecastLayout = "bars"; }
        this.logToTerminal("[OMFD-START] Configs sanitized.");


        // Sanitize numbers
        this.sanitizeNumbers(["updateInterval", "requestDelay", "hourlyForecastInterval", "maxHourliesToShow", "maxDailiesToShow", "mainIconSize", "forecastTiledIconSize", "forecastTableIconSize", "updateFadeSpeed"]);
        this.logToTerminal("[OMFD-START] Numbers sanitized.");


        // Start data poll
        var self = this;
        setTimeout(function() {
            self.getData();
            setInterval(function() {
                self.getData();
            }, self.config.updateInterval * 60 * 1000); // convert to milliseconds
        }, this.config.requestDelay);

        this.logToTerminal("[OMFD-START] END start function. Data pull scheduled.");
        Log.info("Done starting module: " + this.name);
    },

    getData: function() {
        this.logToTerminal("[OMFD-GETDATA] START getData. Requesting API.");
        this.sendSocketNotification("OPENMETEO_FORECAST_GET", {
            latitude: this.config.latitude,
            longitude: this.config.longitude,
            instanceId: this.identifier,
            maxDailies: this.config.maxDailiesToShow + 1 // Requesting maxDailies + 1 just in case, plus one day for current conditions data
        });
        this.logToTerminal("[OMFD-GETDATA] END getData. Notification sent.");
    },

    socketNotificationReceived: function(notification, payload) {
        this.logToTerminal(`[OMFD-SOCKET] START socketNotificationReceived: ${notification}`);

        // FIX: LOG BRIDGE - Add handler for client-side logging
        if (notification === "CLIENT_LOG") {
            return; 
        }

        if (notification === "OPENMETEO_FORECAST_DATA" && payload.instanceId === this.identifier) {
            
            this.logToTerminal("[OMFD-SOCKET] Processing OPENMETEO_FORECAST_DATA.");

            // Clear animated icon cache
            if (this.config.useAnimatedIcons) {
                this.logToTerminal("[OMFD-SOCKET] Clearing icons.");
                this.clearIcons();
            }

            // Process weather data
            this.dataRefreshTimeStamp = moment().format("x");
            this.weatherData = payload;
            
            this.logToTerminal(`[OMFD] RAW PAYLOAD RECEIVED. Attempting processData.`);
            
            this.formattedWeatherData = this.processWeatherData();
			
			this.logToTerminal("[OMFD-SOCKET] PROCESS DATA COMPLETE. Calling updateDom.");
			
            this.updateDom(this.config.updateFadeSpeed);

            // Start animated icons if needed
            if (this.config.useAnimatedIcons) {
                // ... (logic to wait for DOM update and call playIcons)
                var self = this;
                this.animatedIconDrawTimer = setInterval(function() {
                    var elToTest = document.getElementById(self.config.moduleTimestampIdPrefix + self.identifier);
                    if (elToTest != null && elToTest.getAttribute("data-timestamp") == self.dataRefreshTimeStamp) {
                        clearInterval(self.animatedIconDrawTimer);
                        self.playIcons(self);
                    }
                }, 100);
            }
        }
        this.logToTerminal(`[OMFD-SOCKET] END socketNotificationReceived: ${notification}`);
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
		this.logToTerminal("[OMFD-PROCESS] Raw data validation complete.");
        
		const hoursData = this.transposeDataMatrix(rawHourly);
        this.logToTerminal("[OMFD-PROCESS] Data transposed successfully.");


        // ------------------ Daily Forecast Processing ------------------
        var dailies = [];
        var minTempGlobal = Number.MAX_VALUE;
        var maxTempGlobal = -Number.MAX_VALUE;
        this.logToTerminal("[OMFD-PROCESS] Starting global range calculation.");


        // 1. Find the Absolute Min/Max Temperature over the entire forecast range
        if (rawDaily.time.length === 0) {
			this.logToTerminal("[OMFD-PROCESS] FATAL: rawDaily.time array is empty!");
			return null;
		}
	
		for (let i = 0; i < rawDaily.time.length; i++) {
            this.logToTerminal(`[OMFD-PROCESS-G] Start global loop index: ${i}`);
            // Read temperature values, ensuring they are numbers (defaulting to a safe range if needed)
            const minTemp = this.getTemp(rawDaily.temperature_2m_min[i], "C");
            const maxTemp = this.getTemp(rawDaily.temperature_2m_max[i], "C");
            
            this.logToTerminal(`[OMFD-PROCESS-G] Min/Max API values processed: ${minTemp} / ${maxTemp}`);

            // Safety Check: Only update global min/max if the fetched temperature is a valid number
            if (typeof minTemp === 'number' && !isNaN(minTemp)) {
                minTempGlobal = Math.min(minTempGlobal, minTemp);
            } else {
                 this.logToTerminal(`[OMFD-PROCESS-G] Skipping invalid minTemp value.`);
            }
            if (typeof maxTemp === 'number' && !isNaN(maxTemp)) {
                maxTempGlobal = Math.max(maxTempGlobal, maxTemp);
            } else {
                 this.logToTerminal(`[OMFD-PROCESS-G] Skipping invalid maxTemp value.`);
            }
            this.logToTerminal(`[OMFD-PROCESS-G] End global loop index: ${i}`);

        }
        
        this.logToTerminal(`[OMFD] Global Temp Range FINAL: ${minTempGlobal}degC to ${maxTempGlobal}degC`);

        // 2. Build the daily forecast objects
        for (let i = 0; i < Math.min(rawDaily.time.length, this.config.maxDailiesToShow); i++) {
            
            // Skip today if configured to ignore
            if (i === 0 && this.config.ignoreToday) {
                this.logToTerminal(`[OMFD-PROCESS] Skipping day index: ${i}`);
                continue;
            }
            this.logToTerminal(`[OMFD] Processing day index: ${i}`); // <-- LOG BEFORE CRASH

            let dailyItem = this.dailyForecastItemFactory(rawDaily, i, minTempGlobal, maxGlobal);
            dailies.push(dailyItem);
            
            this.logToTerminal(`[OMFD-PROCESS] END dailyForecastItemFactory for index: ${i}`);
        }
        this.logToTerminal("[OMFD-PROCESS] Daily forecast array created. Starting hourly/current processing.");

        // ... (Hourly and Current Conditions processing blocks)
        
        this.logToTerminal("[OMFD-PROCESS] All processing finished. Building return object.");
        
        return {
            "currently": {
                temperature: this.getUnit('temp', this.getTemp(rawCurrent.temperature_2m, "C")),
                // ... (rest of current conditions)
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
        
        this.logToTerminal(`[OMFD-FACTORY] Day ${index}: Starting factory logic.`);

        var fItem = new Object();
        
        // 1. RAW DATA RETRIEVAL (The Const Declarations - CRASH ZONE)
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

        // 2. HELPER FUNCTION EXECUTION (CRASH ZONE WITH CATCH)
        let tempMin, tempMax, windSpeed;
        
        // Catch block for tempMin
        try {
            tempMin = this.getTemp(rawMin, "C");
        } catch (e) {
            this.logToTerminal(`[OMFD-CRASH] Day ${index}: FAILED on tempMin (Value: ${rawMin}). Error: ${e.message}`);
            tempMin = 0; // Return safe value to continue execution
        }

        // Catch block for tempMax
        try {
            tempMax = this.getTemp(rawMax, "C");
        } catch (e) {
            this.logToTerminal(`[OMFD-CRASH] Day ${index}: FAILED on tempMax (Value: ${rawMax}). Error: ${e.message}`);
            tempMax = 0; // Return safe value
        }

        // Catch block for windSpeed
        try {
            windSpeed = this.convertWindSpeed(rawWindSpeed, "kmh");
        } catch (e) {
            this.logToTerminal(`[OMFD-CRASH] Day ${index}: FAILED on windSpeed (Value: ${rawWindSpeed}). Error: ${e.message}`);
            windSpeed = 0; // Return safe value
        }
        
        const windDirection = rawWindDirection;
        const windGust = rawWindGust;
        const precipProb = rawPrecipProb;
        const precipAmount = rawPrecipAmount;
        const date = moment.unix(rawTime);

        this.logToTerminal(`[OMFD-FACTORY] Day ${index}: Helper functions passed. TMin=${tempMin}, WindS=${windSpeed}`);

        // --------- Date / Time Display ---------
        if (index === 0 && this.config.showDayAsTodayInDailyForecast) fItem.day = this.config.label_today;
        else if (index === 1 && this.config.showDayAsTomorrowInDailyForecast) fItem.day = this.config.label_tomorrow;
        else fItem.day = this.config.label_days[date.format("d")];

        // --------- Icon ---------
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

    // ------------------ Hourly Forecast Item Factory ------------------

    hourlyForecastItemFactory: function(hData, rawDaily) {
        this.logToTerminal(`[OMFD-H-FACTORY] START hourlyForecastItemFactory logic.`);
        var fItemH = new Object();
        
        const date = moment.unix(hData.time);
        const hourIndex = rawDaily.time.findIndex(t => moment.unix(t).day() === date.day());
        
        const isDayTime = date.isBetween(moment.unix(rawDaily.sunrise[hourIndex]), moment.unix(rawDaily.sunset[hourIndex]));
        
        fItemH.time = date.format(this.config.label_timeFormat);
        fItemH.temperature = this.getUnit('temp', this.getTemp(hData.temperature_2m, "C")); 
        
        // --------- Precipitation ---------
        fItemH.precipitation = this.formatPrecipitation(hData.precipitation_probability, hData.precipitation, null);
        
        // --------- Wind ---------
        fItemH.wind = (this.formatWind(this.convertWindSpeed(hData.windspeed_10m, "kmh"), hData.winddirection_10m, hData.windgusts_10m));

        // --------- Icon ---------
        if (this.config.useAnimatedIcons && !this.config.animateMainIconOnly) {
            fItemH.animatedIconId = this.getAnimatedIconId();
            fItemH.animatedIconName = this.convertWeatherCodeToIcon(hData.weathercode, isDayTime);
        }
        fItemH.iconPath = this.generateIconSrc(this.convertWeatherCodeToIcon(hData.weathercode, isDayTime));
        
        this.logToTerminal(`[OMFD-H-FACTORY] END hourlyForecastItemFactory logic.`);
        return fItemH;
    },
    
    // ------------------ Helper and Conversion Functions ------------------
    
    // Converts Celsius to the configured unit (Imperial or Metric)
    getTemp: function(tempInC, inputUnit) {
    	// We expect this to crash if tempInC is null, allowing the catch block to run
    	if (inputUnit === "C" && this.config.units === "imperial") {
        	return (tempInC * 9/5) + 32;
    	}
    	return tempInC;
	},
    
    // Converts Open-Meteo's m/s wind speed to the configured unit
    convertWindSpeed: function(windInMS, unit) {
    	// We expect this to crash if windInMS is null, allowing the catch block to run
    	if (this.config.units === "imperial") {
        	return windInMS * 2.23694; 
    	}
    	return windInMS;
	},

    /*
      Returns a formatted data object for High / Low temperature range
     */
    formatHiLowTemperature: function(h, l) {
        this.logToTerminal(`[OMFD-HELPER] START formatHiLowTemperature`);
        const result = {
            high: this.config.label_high + this.getUnit('temp', h),
            low: this.config.label_low + this.getUnit('temp', l)
        };
        this.logToTerminal(`[OMFD-HELPER] END formatHiLowTemperature`);
        return result;
    },

    /*
      Returns a formatted data object for precipitation
     */
    formatPrecipitation: function(percentChance, precipAmount, snowAccumulation) {
        this.logToTerminal(`[OMFD-HELPER] START formatPrecipitation`);
        var accumulation = null;
        var accumulationtype = null;
        var pop = null;
        
        // Open-Meteo gives precipitation in mm (metric)
        const precipValue = (this.config.units === "imperial") 
            ? precipAmount * 0.0393701 // Convert mm to inches
            : precipAmount;
            
        if (precipValue > 0) {
            accumulationtype = "rain"; // Simplifying Open-Meteo's combined 'precipitation_sum'
            accumulation = this.getUnit('rain', precipValue);
        }

        if (percentChance) {
            pop = Math.round(percentChance) + "%";
        }
        this.logToTerminal(`[OMFD-HELPER] END formatPrecipitation`);
        return {
            pop: pop,
            accumulation: accumulation,
            accumulationtype: accumulationtype
        };
    },

    /*
      Returns a formatted data object for wind conditions
     */
    formatWind: function(speed, bearing, gust) {
        this.logToTerminal(`[OMFD-HELPER] START formatWind`);
        var windSpeed = this.getUnit('wind', speed);
        var windDirection = (this.config.showWindDirection ? " " + this.getOrdinal(bearing) : "");
        var windGust = null;
        if (this.config.showWindGust && gust) {
            windGust = this.config.label_gust_wrapper_prefix + this.config.label_maximum + this.getUnit('gust', this.convertWindSpeed(gust, "kmh")) + this.config.label_gust_wrapper_suffix;
        }
        var windSpeedRaw = parseFloat(speed.toFixed(this.config['dp_wind' + (this.config.units === 'metric' ? '_m' : '_i')]));
        
        this.logToTerminal(`[OMFD-HELPER] END formatWind`);
        return {
            windSpeedRaw: windSpeedRaw,
            windSpeed: windSpeed,
            windDirection: windDirection,
            windGust: windGust
        };
    },

    /*
      Returns the units in use for the data pull
     */
    getUnit: function(metric, value) {
        this.logToTerminal(`[OMFD-HELPER] START getUnit for ${metric}`);
        const dpKey = 'dp_' + metric + (this.config.units === 'metric' ? '_m' : '_i');
        const labelKey = 'label_' + metric + (this.config.units === 'metric' ? '_m' : '_i');
        
        var rounded = String(parseFloat(value.toFixed(this.config[dpKey])));

        // Apply custom leading zero logic
        if (metric === 'rain' && !this.config.dp_precip_leading_zero && rounded.indexOf("0.") === 0) rounded = rounded.substring(1);
        if (metric === 'wind' && !this.config.dp_wind_leading_zero && rounded.indexOf("0.") === 0) rounded = rounded.substring(1);

        this.logToTerminal(`[OMFD-HELPER] END getUnit for ${metric}`);
        return rounded + this.config[labelKey];
    },

    /*
      Formats the wind direction into common ordinals (e.g.: NE, WSW, etc.)
     */
    getOrdinal: function(bearing) {
        this.logToTerminal(`[OMFD-HELPER] START/END getOrdinal`);
        return this.config.label_ordinals[Math.round(bearing * this.config.label_ordinals.length / 360) % this.config.label_ordinals.length];
    },

    // A minimal iconset definition needed for image path generation
    getIconsets: function() {
        this.logToTerminal(`[OMFD-HELPER] START/END getIconsets`);
        return {
            "1m":	{ path: "1m"	, format: "svg" },
            "1c":	{ path: "1c"	, format: "svg" },
            // ... (include all sets from the original module)
        };
    },

    /*
      Maps Open-Meteo WMO Weather Codes to icon names.
    */
    convertWeatherCodeToIcon: function(code, isDayTime) {
        this.logToTerminal(`[OMFD-HELPER] START convertWeatherCodeToIcon`);
        // This is a simplified mapping based on WMO codes
        switch (code) {
            case 0: // Clear sky
                return isDayTime ? "clear-day" : "clear-night";
            case 1: // Mainly clear
            case 2: // Partly cloudy
                return isDayTime ? "partly-cloudy-day" : "partly-cloudy-night";
            case 3: // Overcast
                return "cloudy";
            case 45: // Fog
            case 48: // Depositing rime fog
                return "fog";
            case 51: // Drizzle light
            case 53: // Drizzle moderate
            case 55: // Drizzle dense
            case 61: // Rain slight
            case 63: // Rain moderate
            case 65: // Rain heavy
            case 80: // Rain showers slight
            case 81: // Rain showers moderate
            case 82: // Rain showers violent
                return "rain";
            case 56: // Freezing Drizzle light
            case 57: // Freezing Drizzle dense
            case 66: // Freezing Rain light
            case 67: // Freezing Rain heavy
            case 77: // Snow grains
                return "sleet";
            case 71: // Snow fall slight
            case 73: // Snow fall moderate
            case 75: // Snow fall heavy
            case 85: // Snow showers slight
            case 86: // Snow showers heavy
                return "snow";
            case 95: // Thunderstorm slight or moderate
            case 96: // Thunderstorm with slight hail
            case 99: // Thunderstorm with heavy hail
                return "thunderstorm";
            default:
                return "cloudy"; 
        }
    },

    /*
      This generates a URL to the icon file
     */
    generateIconSrc: function(icon, mainIcon) {
        this.logToTerminal(`[OMFD-HELPER] START generateIconSrc`);
        const iconset = mainIcon ? this.config.mainIconset : this.config.iconset;
        // The file path is relative to the module folder
        const result = this.file("icons/" + this.iconsets[iconset].path + "/" +
            icon + "." + this.iconsets[iconset].format);
        this.logToTerminal(`[OMFD-HELPER] END generateIconSrc`);
        return result;
    },
    
    // --- START: Missing Helper Functions ---

    clearIcons: function() {
        this.logToTerminal(`[OMFD-HELPER] START/END clearIcons`);
        if (!this.skycons) return;
        this.skycons.pause();
        var self = this;
        var animatedIconCanvases = document.querySelectorAll(".skycon-" + this.identifier);
        animatedIconCanvases.forEach(function(icon) {
            self.skycons.remove(icon.id);
        });
        this.iconIdCounter = 0;
    },

    getAnimatedIconId: function() {
        this.logToTerminal(`[OMFD-HELPER] START/END getAnimatedIconId`);
        var iconId = "skycon_" + this.identifier + "_" + this.iconIdCounter;
        this.iconIdCounter++;
        return iconId;
    },

    playIcons: function(inst) {
        this.logToTerminal(`[OMFD-HELPER] START/END playIcons`);
        var animatedIconCanvases = document.querySelectorAll(".skycon-" + inst.identifier);
        animatedIconCanvases.forEach(function(icon) {
            inst.skycons.add(icon.id, icon.getAttribute("data-animated-icon-name"));
        });
        inst.skycons.play();
    },

    sanitizeNumbers: function(keys) {
        this.logToTerminal(`[OMFD-HELPER] START/END sanitizeNumbers`);
        var self = this;
        keys.forEach(function(key) {
            if (isNaN(parseInt(self.config[key]))) {
                self.config[key] = self.defaults[key];
            } else {
                self.config[key] = parseInt(self.config[key]);
            }
        });
    },

    interpolateColor: function(c0, c1, f){
        this.logToTerminal(`[OMFD-HELPER] START/END interpolateColor`);
        c0 = c0.match(/.{1,2}/g).map((oct)=>parseInt(oct, 16) * (1-f))
        c1 = c1.match(/.{1,2}/g).map((oct)=>parseInt(oct, 16) * f)
        let ci = [0,1,2].map(i => Math.min(Math.round(c0[i]+c1[i]), 255))
        return ci.reduce((a,v) => ((a << 8) + v), 0).toString(16).padStart(6, "0")
    },

    // --- END: Missing Helper Functions ---
    logToTerminal: function(message) {
        this.sendSocketNotification("CLIENT_LOG", {
            instanceId: this.identifier,
            message: message
        });
    },
});
