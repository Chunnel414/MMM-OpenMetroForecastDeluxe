/*********************************

  MagicMirror² Module:
  MMM-OpenMeteoForecastDeluxe
  https://github.com/{YourGitHubName}/MMM-OpenMeteoForecastDeluxe

  Based on the structure of MMM-AccuWeatherForecastDeluxe.
  
  Weather data provided by Open-Meteo API (free and keyless).
  
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
        return ["moment.js", this.file("skycons.js"), this.file("MMM-OpenMeteoForecastDeluxe.js")];
    },

    getStyles: function() {
        return ["MMM-OpenMeteoForecastDeluxe.css"]; // Reusing the original CSS
    },

    getTemplate: function() {
        // Since you renamed the .njk file, update this call
        return "MMM-OpenMeteoForecastDeluxe.njk"; 
    },

    getTemplateData: function() {
		// FIX 2: Ensure iconsets is initialized before accessing it.
        if (!this.iconsets) {
            this.iconsets = this.getIconsets();
        }
		
        return {
            phrases: this.phrases,
            loading: this.formattedWeatherData == null ? true : false,
            config: this.config,
            forecast: this.formattedWeatherData,
            inlineIcons: {
                // Assuming inline icons are in the module's icons folder
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
    },

    start: function() {
        Log.info("Starting module: " + this.name);
        this.weatherData = null;
        this.iconIdCounter = 0;
        this.formattedWeatherData = null;
        this.animatedIconDrawTimer = null;
        this.iconsets = this.getIconsets(); // Initializes this.iconsets
        
        // FIX 1: Define 'phrases' early to prevent crash in getTemplateData
        this.phrases = {
			loading: this.translate("LOADING")
		};

        // Initialize Skycons if animated icons are used (assuming the file is available)
        if (this.config.useAnimatedIcons) {
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

        // Sanitize numbers
        this.sanitizeNumbers(["updateInterval", "requestDelay", "hourlyForecastInterval", "maxHourliesToShow", "maxDailiesToShow", "mainIconSize", "forecastTiledIconSize", "forecastTableIconSize", "updateFadeSpeed"]);

        // Start data poll
        var self = this;
        setTimeout(function() {
            self.getData();
            setInterval(function() {
                self.getData();
            }, self.config.updateInterval * 60 * 1000); // convert to milliseconds
        }, this.config.requestDelay);

        Log.info("Done starting module: " + this.name);
    },

    getData: function() {
        this.sendSocketNotification("OPENMETEO_FORECAST_GET", {
            latitude: this.config.latitude,
            longitude: this.config.longitude,
            instanceId: this.identifier,
            maxDailies: this.config.maxDailiesToShow + 1 // Requesting maxDailies + 1 just in case, plus one day for current conditions data
        });
    },

    socketNotificationReceived: function(notification, payload) {
        // FIX 3: LOG BRIDGE - Add handler for client-side logging
        if (notification === "CLIENT_LOG") {
            // Note: node_helper should handle printing this to the terminal
            return; 
        }

        if (notification === "OPENMETEO_FORECAST_DATA" && payload.instanceId === this.identifier) {
            
            // Clear animated icon cache
            if (this.config.useAnimatedIcons) {
                this.clearIcons();
            }

            // Process weather data
            this.dataRefreshTimeStamp = moment().format("x");
            this.weatherData = payload;
            
            // LOG 1: Confirm raw data payload arrival
            this.logToTerminal("[OMFD] RAW PAYLOAD RECEIVED. Attempting processData.");
            
            this.formattedWeatherData = this.processWeatherData();
			
			// LOG 2: Confirm processWeatherData completed
			this.logToTerminal("[OMFD] PROCESS DATA COMPLETE. RENDER STARTING.");
			
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
    },

    /*
      This is the core function for processing Open-Meteo's parallel arrays and calculating bar properties.
    */
    processWeatherData: function() {
        this.logToTerminal("[OMFD] Starting processWeatherData...");
        
        const rawDaily = this.weatherData.daily;
        const rawHourly = this.weatherData.hourly;
        const currentHour = moment().hour();
        
        if (!rawDaily || !rawHourly) {
			this.logToTerminal("[OMFD] FATAL: Missing rawDaily or rawHourly array!");
			return null;
		}
		const hoursData = this.transposeDataMatrix(rawHourly);

        // ------------------ Daily Forecast Processing ------------------
        var dailies = [];
        var minTempGlobal = Number.MAX_VALUE;
        var maxTempGlobal = -Number.MAX_VALUE;

        // 1. Find the Absolute Min/Max Temperature over the entire forecast range
        if (rawDaily.time.length === 0) {
			this.logToTerminal("[OMFD] FATAL: rawDaily.time array is empty!");
			return null;
		}
	
		for (let i = 0; i < rawDaily.time.length; i++) {
            // Read temperature values, ensuring they are numbers (defaulting to a safe range if needed)
            const minTemp = this.getTemp(rawDaily.temperature_2m_min[i], "C");
            const maxTemp = this.getTemp(rawDaily.temperature_2m_max[i], "C");
            
            this.logToTerminal(`[OMFD-LOOP] Index ${i}: Min/Max API values processed: ${minTemp} / ${maxTemp}`); // <-- NEW LOG

            // Safety Check: Only update global min/max if the fetched temperature is a valid number
            if (typeof minTemp === 'number' && !isNaN(minTemp)) {
                minTempGlobal = Math.min(minTempGlobal, minTemp);
            } else {
                 this.logToTerminal(`[OMFD-LOOP] Index ${i}: Skipping invalid minTemp value.`); // <-- NEW LOG
            }
            if (typeof maxTemp === 'number' && !isNaN(maxTemp)) {
                maxTempGlobal = Math.max(maxTempGlobal, maxTemp);
            } else {
                 this.logToTerminal(`[OMFD-LOOP] Index ${i}: Skipping invalid maxTemp value.`); // <-- NEW LOG
            }
        }
        
        this.logToTerminal(`[OMFD] Global Temp Range: ${minTempGlobal}degC to ${maxTempGlobal}degC`);

        // 2. Build the daily forecast objects
        for (let i = 0; i < Math.min(rawDaily.time.length, this.config.maxDailiesToShow); i++) {
            
            // Skip today if configured to ignore
            if (i === 0 && this.config.ignoreToday) continue;
            this.logToTerminal(`[OMFD] Processing day index: ${i}`);

            let dailyItem = this.dailyForecastItemFactory(rawDaily, i, minTempGlobal, maxTempGlobal);
            dailies.push(dailyItem);
        }
        this.logToTerminal("[OMFD] Daily forecast array created. Starting hourly/current processing.");

        // ------------------ Hourly Forecast Processing ------------------
        var hourlies = [];        
        var displayCounter = 0;
        var currentIndex = 0; 
        
        // Find the index of the current hour (to start from now + interval)
        // Since Open-Meteo gives hourly data, we find the first hour *after* now 
        const nowUnix = moment().unix();
        let startIndex = hoursData.findIndex(h => moment.unix(h.time).unix() > nowUnix);

        // Adjust to the next interval if needed
        while (startIndex > 0 && (startIndex % this.config.hourlyForecastInterval) !== 0) {
            startIndex++;
        }
        
        if (startIndex === -1) startIndex = 0; // Fallback if no future hour found

        currentIndex = startIndex;

        while (displayCounter < this.config.maxHourliesToShow) {
            if (hoursData[currentIndex] == null) break;

            hourlies.push(this.hourlyForecastItemFactory(hoursData[currentIndex], rawDaily));

            currentIndex += this.config.hourlyForecastInterval;
            displayCounter++;
        }
        
        // ------------------ Current Conditions Processing ------------------
        this.logToTerminal("[OMFD] Starting Current/Hourly Processing...");
        
		const rawCurrent = this.weatherData.current;

		// Use the hourly data point closest to the current time for current conditions
        const currentHourIndex = rawHourly.time.findIndex(t => moment.unix(t).hour() === currentHour);
        const hourlyCurrentData = hoursData[currentHourIndex] || hoursData[0]; 
        
        // Use the first day of the daily forecast for today's high/low
        const todayDaily = this.dailyForecastItemFactory(rawDaily, 0, minTempGlobal, maxTempGlobal);

        // This object structure matches what your Nunjucks template expects (e.g., `forecast.currently.temperature`)
        this.logToTerminal("[OMFD] Data object successfully built. Returning formatted data.");
        return {
            "currently": {
                temperature: this.getUnit('temp', this.getTemp(rawCurrent.temperature_2m, "C")),
                feelslike: this.getUnit('temp', this.getTemp(rawCurrent.apparent_temperature, "C")),
                animatedIconId: this.config.useAnimatedIcons ? this.getAnimatedIconId() : null,
                animatedIconName: this.convertWeatherCodeToIcon(rawCurrent.weathercode, moment().isBetween(todayDaily.sunrise, todayDaily.sunset)),
                iconPath: this.generateIconSrc(this.convertWeatherCodeToIcon(rawCurrent.weathercode, moment().isBetween(todayDaily.sunrise, todayDaily.sunset)), true),
                tempRange: todayDaily.tempRange,
                precipitation: this.formatPrecipitation(hourlyCurrentData.precipitation_probability, hourlyCurrentData.precipitation, null),
                wind: this.formatWind(
                    this.convertWindSpeed(rawCurrent.windspeed_10m, "ms"), 
                    rawCurrent.winddirection_10m, 
                    rawCurrent.windgusts_10m
                ),
                sunrise: todayDaily.sunrise,
                sunset: todayDaily.sunset,
            },
            // The original module had a summary, so we use the attribution here for consistency
            "summary": "Powered by Open-Meteo",
            "hourly": hourlies,
            "daily": dailies,
        };
    },
    
    // Convert Open-Meteo's parallel arrays into an array of objects for easier iteration
    transposeDataMatrix: function(data) {
        if (!data || !data.time) return [];
        return data.time.map((_, index) => Object.keys(data).reduce((row, key) => {
            return {
                ...row,
                [key]: data[key][index]
            };
        }, {}));
    },

    // ------------------ Daily Forecast Item Factory (The Bars Logic) ------------------

    dailyForecastItemFactory: function(fData, index, minGlobal, maxGlobal) {
        var fItem = new Object();
        
        const tempMin = this.getTemp(fData.temperature_2m_min[index], "C");
        const tempMax = this.getTemp(fData.temperature_2m_max[index], "C");
        const windSpeed = this.convertWindSpeed(fData.windspeed_10m_max[index], "kmh");
        const windDirection = fData.winddirection_10m_dominant[index];
        const windGust = fData.windgusts_10m_max[index];
        const precipProb = fData.precipitation_probability_max[index];
        const precipAmount = fData.precipitation_sum[index];
        const date = moment.unix(fData.time[index]);

        // --------- Date / Time Display ---------
        if (index === 0 && this.config.showDayAsTodayInDailyForecast) fItem.day = this.config.label_today;
        else if (index === 1 && this.config.showDayAsTomorrowInDailyForecast) fItem.day = this.config.label_tomorrow;
        else fItem.day = this.config.label_days[date.format("d")];

        // --------- Icon ---------
        const isDayTime = date.isBetween(moment.unix(fData.sunrise[index]), moment.unix(fData.sunset[index]));
        if (this.config.useAnimatedIcons && !this.config.animateMainIconOnly) {
            fItem.animatedIconId = this.getAnimatedIconId();
            fItem.animatedIconName = this.convertWeatherCodeToIcon(fData.weathercode[index], isDayTime);
        }
        fItem.iconPath = this.generateIconSrc(this.convertWeatherCodeToIcon(fData.weathercode[index], isDayTime));
        fItem.sunrise = moment.unix(fData.sunrise[index]);
        fItem.sunset = moment.unix(fData.sunset[index]);
        
        // --------- Temperature Range & Bars Logic (CORE REIMPLEMENTATION) ---------
        fItem.tempRange = this.formatHiLowTemperature(tempMax, tempMin);
        
        if (this.config.dailyForecastLayout === "bars") {
            const rangeTotal = maxGlobal - minGlobal;
            
            // CRITICAL CHECK: Prevent division by zero if all temperatures are the same
            if (rangeTotal === 0) { 
                this.logToTerminal("[OMFD] CRASH PREVENTED: Global temperature range is zero.");
                fItem.bars = { leftSpacerWidth: 0, barWidth: 100, rightSpacerWidth: 0 };
                fItem.colorStart = this.config.lowColor;
                fItem.colorEnd = this.config.highColor;
            } else {
                fItem.bars = {
                    min: minGlobal,
                    max: maxGlobal,
                    total: rangeTotal,
                    interval: 100 / rangeTotal, // Percentage per degree
                };
                
                // Bar width is the day's temperature span
                fItem.bars.barWidth = Math.round(fItem.bars.interval * (tempMax - tempMin));
                
                // Left spacer width is the difference from the overall min to the day's low
                fItem.bars.leftSpacerWidth = Math.round(fItem.bars.interval * (tempMin - minGlobal));

                // Right spacer width is the difference from the day's high to the overall max
                fItem.bars.rightSpacerWidth = Math.round(fItem.bars.interval * (maxGlobal - tempMax));

                // Color interpolation for the gradient
                var colorLo = this.config.lowColor.substring(1);
                var colorHi = this.config.highColor.substring(1);
                
                // Calculate color factor at the start and end of this day's bar relative to the global range
                var colorStartPos = (tempMin - minGlobal) / rangeTotal;
            	var colorEndPos = (tempMax - minGlobal) / rangeTotal;
            
            	// Log raw positions before clamping
            	this.logToTerminal(`[OMFD-COLOR] Day ${index}: Raw Start/End Pos: ${colorStartPos.toFixed(4)} / ${colorEndPos.toFixed(4)}`);

            	// Sanitize position: Clamp values to a safe range (0.0 to 1.0)
            	const safeStartPos = Math.max(0, Math.min(1, colorStartPos));
            	const safeEndPos = Math.max(0, Math.min(1, colorEndPos));

            	var colorLo = this.config.lowColor.substring(1);
            	var colorHi = this.config.highColor.substring(1);
            
            	fItem.colorStart = '#' + this.interpolateColor(colorLo, colorHi, safeStartPos);
            	fItem.colorEnd = '#' + this.interpolateColor(colorLo, colorHi, safeEndPos);

            	this.logToTerminal(`[OMFD-COLOR] Day ${index}: Colors interpolated successfully.`);
            }
        }
        
		// --------- Precipitation ---------
        this.logToTerminal(`[OMFD-PRECIP] Processing precip. Pop: ${precipProb}, Amt: ${precipAmount}`); // <-- NEW LOG START

        fItem.precipitation = this.formatPrecipitation(precipProb, precipAmount, null); 
        
        this.logToTerminal(`[OMFD-PRECIP] Precipitation formatted successfully.`); // <-- NEW LOG END

        // --------- Wind ---------
        this.logToTerminal(`[OMFD-WIND] Starting formatWind call.`); // <-- NEW LOG START
        fItem.wind = (this.formatWind(windSpeed, windDirection, windGust));

        return fItem;
    },

    // ------------------ Hourly Forecast Item Factory ------------------

    hourlyForecastItemFactory: function(hData, rawDaily) {
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
        
        return fItemH;
    },
    
    // ------------------ Helper and Conversion Functions ------------------
    
    // Converts Celsius to the configured unit (Imperial or Metric)
    getTemp: function(tempInC, inputUnit) {
        if (inputUnit === "C" && this.config.units === "imperial") {
            return (tempInC * 9/5) + 32;
        }
        return tempInC;
    },
    
    // Converts Open-Meteo's m/s wind speed to the configured unit
    convertWindSpeed: function(windInMS, unit) {
        if (this.config.units === "imperial") {
            // Convert to MPH
            return windInMS * 2.23694; 
        }
        // Metric (m/s)
        return windInMS;
    },

    /*
      Returns a formatted data object for High / Low temperature range
     */
    formatHiLowTemperature: function(h, l) {
        return {
            high: this.config.label_high + this.getUnit('temp', h),
            low: this.config.label_low + this.getUnit('temp', l)
        };
    },

    /*
      Returns a formatted data object for precipitation
     */
    formatPrecipitation: function(percentChance, precipAmount, snowAccumulation) {
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
        this.logToTerminal(`[OMFD-WIND] Starting formatWind. Speed: ${speed}, Gust: ${gust}`);

        // Safety check: ensure speed is a valid number, default to 0 if null/undefined
        const safeSpeed = (speed == null || isNaN(speed)) ? 0 : speed;
        // Safety check: ensure gust is a valid number, set to null if invalid
        const safeGust = (gust == null || isNaN(gust)) ? null : gust;

        var windSpeed = this.getUnit('wind', safeSpeed);
        var windDirection = (this.config.showWindDirection ? " " + this.getOrdinal(bearing) : "");
        var windGust = null;

        if (this.config.showWindGust && safeGust !== null) {
            // NOTE: Using safeGust ensures convertWindSpeed receives a number
            windGust = this.config.label_gust_wrapper_prefix + this.config.label_maximum + this.getUnit('gust', this.convertWindSpeed(safeGust, "kmh")) + this.config.label_gust_wrapper_suffix;
        }

        // Use safeSpeed for the raw calculation
        var windSpeedRaw = parseFloat(safeSpeed.toFixed(this.config['dp_wind' + (this.config.units === 'metric' ? '_m' : '_i')]));
        
        this.logToTerminal(`[OMFD-WIND] Successfully formatted wind data.`);

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
        const dpKey = 'dp_' + metric + (this.config.units === 'metric' ? '_m' : '_i');
        const labelKey = 'label_' + metric + (this.config.units === 'metric' ? '_m' : '_i');
        
        var rounded = String(parseFloat(value.toFixed(this.config[dpKey])));

        // Apply custom leading zero logic
        if (metric === 'rain' && !this.config.dp_precip_leading_zero && rounded.indexOf("0.") === 0) rounded = rounded.substring(1);
        if (metric === 'wind' && !this.config.dp_wind_leading_zero && rounded.indexOf("0.") === 0) rounded = rounded.substring(1);

        return rounded + this.config[labelKey];
    },

    /*
      Formats the wind direction into common ordinals (e.g.: NE, WSW, etc.)
     */
    getOrdinal: function(bearing) {
        return this.config.label_ordinals[Math.round(bearing * this.config.label_ordinals.length / 360) % this.config.label_ordinals.length];
    },

    // A minimal iconset definition needed for image path generation
    getIconsets: function() {
        return {
            "1m":	{ path: "1m"	, format: "svg" },
            "1c":	{ path: "1c"	, format: "svg" },
            // ... (include all sets from the original module)
        };
    },

    /*
      Maps Open-Meteo WMO Weather Codes to icon names.
      https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-Code.html
    */
    convertWeatherCodeToIcon: function(code, isDayTime) {
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
        const iconset = mainIcon ? this.config.mainIconset : this.config.iconset;
        // The file path is relative to the module folder
        return this.file("icons/" + this.iconsets[iconset].path + "/" +
            icon + "." + this.iconsets[iconset].format);
    },
    
    // --- START: Missing Helper Functions ---

    clearIcons: function() {
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
        var iconId = "skycon_" + this.identifier + "_" + this.iconIdCounter;
        this.iconIdCounter++;
        return iconId;
    },

    playIcons: function(inst) {
        var animatedIconCanvases = document.querySelectorAll(".skycon-" + inst.identifier);
        animatedIconCanvases.forEach(function(icon) {
            inst.skycons.add(icon.id, icon.getAttribute("data-animated-icon-name"));
        });
        inst.skycons.play();
    },

    sanitizeNumbers: function(keys) {
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
