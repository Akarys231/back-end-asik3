const express = require("express");
const bodyParser = require("body-parser");
const session = require('express-session');
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const ejs = require('ejs');
const User = require('./modelss/User');


const Weather = require("./modelss/Weather");
const unsplashApiKey = 'I0woIE2_xGrse8L4a1A3hi1awymK3u9-MBWSL9aNkUo';

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.use(session({
    secret: '123',
    resave: false,
    saveUninitialized: true
}));
app.set('view engine', 'ejs');

const dbUrl = "mongodb+srv://akarys:3872fsFf@cluster0.0exorsi.mongodb.net/akarys";
const connectionParams = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
};

mongoose.connect(dbUrl, connectionParams)
    .then(() => console.info("Connected to the database"))
    .catch((e) => console.log("Error connecting to the database", e));

app.get("/", function (req, res) {
    res.render("index", { userIsLoggedIn: req.session.user });
});


app.get("/login", function (req, res) {
    res.render("login", { error: null });
});

app.post("/login", async function (req, res) {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        if (user && !user.deletedAt && (await bcrypt.compare(password, user.password))) {
            req.session.user = { username: user.username, searchHistory: user.searchHistory, isAdmin: user.isAdmin };

            if (user.isAdmin) {
                res.redirect("/admin");
            } else {
                res.redirect("/weather"); 
            }
        } else {
            res.render("login", { error: "Invalid username or password" });
        }
    } catch (error) {
        console.error("Error during login:", error);
        res.render("login", { error: "An error occurred. Please try again." });
    }
});


app.get("/register", function (req, res) {
    res.render("register", { error: null });
});

app.post("/register", async function (req, res) {
    const { username, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, searchHistory: [] });
        await newUser.save();
        req.session.user = { username: newUser.username, searchHistory: newUser.searchHistory };
        res.redirect("/weather");
    } catch (error) {
        console.error("Error during registration:", error);
        res.render("register", { error: "An error occurred. Please try again." });
    }
});


app.get("/admin", async function (req, res) {
    try {
        const users = await User.find({});
        res.render("admin", { users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.send("An error occurred while fetching user data.");
    }
});


app.get("/admin/add", function (req, res) {
    res.render("addUser");
});


app.post("/admin/add", async function (req, res) {
    const { username, password, isAdmin } = req.body;

    try {
        const isAdminValue = isAdmin === 'true';

        const newUser = new User({
            username,
            password, 
            isAdmin: isAdminValue,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        await newUser.save();

        res.redirect("/admin");
    } catch (error) {
        console.error("Error adding user:", error);
        res.send("An error occurred while adding user.");
    }
});


app.post("/admin/edit/:userId", async function (req, res) {
    const userId = req.params.userId;
    const { username, newPassword, isAdmin } = req.body;

    try {
        const updateObject = {
            username,
            updatedAt: Date.now(),
            isAdmin: isAdmin === 'true',
        };

        if (newPassword) {
            updateObject.password = await bcrypt.hash(newPassword, 10);
        }

        await User.findByIdAndUpdate(userId, updateObject);

        res.redirect("/admin");
    } catch (error) {
        console.error("Error updating user:", error);
        res.send("An error occurred while updating user.");
    }
});



app.get("/admin/edit/:userId", async function (req, res) {
    const userId = req.params.userId;

    try {
        const user = await User.findById(userId);
        res.render("editUser", { user });
    } catch (error) {
        console.error("Error fetching user for edit:", error);
        res.send("An error occurred while fetching user data for edit.");
    }
});


app.post("/admin/delete/:userId", async function (req, res) {
    const userId = req.params.userId;

    try {
        await User.findByIdAndDelete(userId);

        res.redirect("/admin"); 
    } catch (error) {
        console.error("Error when deleting a user:", error);
        res.send("An error occurred while deleting the user.");
    }
});


app.get("/logout", function (req, res) {
    req.session.destroy();
    res.redirect("/");
});


app.get("/weather", function (req, res) {
    const user = req.session.user;
    if (!user) {
        res.redirect("/login");
        return;
    }

    res.render("weather", { username: user.username, searchHistory: user.searchHistory });
});

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

app.post("/weather", async function (req, res) {
    const user = req.session.user;
    if (!user) {
        res.redirect("/login");
        return;
    }

    const city = req.body.city;

    user.searchHistory.push(city);
    await User.updateOne({ username: user.username }, { $set: { searchHistory: user.searchHistory } });

    const apiKey = "9c7f1fc0105702159295fe21fce1c64f";
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

    try {
        console.log("Fetching weather data for:", city);
        const response = await fetch(url);
        const weatherData = await response.json();

        console.log("Weather data received:", weatherData);
        
        
        
        if (weatherData.cod === "404") {
            console.log("City not found. Please try again.");
            res.send("City not found. Please try again.");
            return;
        }

        const temp = weatherData.main.temp;
        const feels = weatherData.main.feels_like;
        const icon = weatherData.weather[0].icon;
        const iconURL = `https://openweathermap.org/img/wn/${icon}@2x.png`;
        const desc = weatherData.weather[0].description;
        const coords = weatherData.coord;
        const humidity = weatherData.main.humidity;
        const pressure = weatherData.main.pressure;
        const windSpeed = weatherData.wind.speed;
        const country = weatherData.sys.country;
        const rainVolume = weatherData.rain ? weatherData.rain["3h"] : 0;

        const mapURL = `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lon}#map=13/${coords.lat}/${coords.lon}`;

        const unsplashUrl = `https://api.unsplash.com/photos/random?query=${city}&client_id=${unsplashApiKey}`;
        try {
            const unsplashResponse = await fetch(unsplashUrl);
            const unsplashData = await unsplashResponse.json();
            const imageUrl = unsplashData.urls.regular;

            const catFactsUrl = "https://catfact.ninja/fact";
            try {
                const catFactsResponse = await fetch(catFactsUrl);
                const catFactsData = await catFactsResponse.json();
                const catFact = catFactsData.fact;

                res.write(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Weather App Result</title>
                    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
                    <style>
                        body {
                            background-color: #f0f0f0;
                            color: #333;
                            padding-top: 20px;
                            padding-bottom: 20px;
                        }
                        .container {
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .weather-container {
                            background-color: #fff;
                            padding: 20px;
                            border-radius: 10px;
                            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
                            margin-bottom: 20px;
                        }
                        .weather-info {
                            display: flex;
                            justify-content: space-between;
                        }
                        .weather-info .left-container,
                        .weather-info .right-container {
                            flex: 1;
                            padding: 10px;
                        }
                        .weather-info .right-container img {
                            max-width: 100px;
                            max-height: 100px;
                        }
                        .map-container {
                            background-color: #fff;
                            padding: 20px;
                            border-radius: 10px;
                            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
                            margin-bottom: 20px;
                            height: 400px;
                        }
                        .city-image {
                            background-color: #fff;
                            padding: 20px;
                            border-radius: 10px;
                            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
                            margin-bottom: 20px;
                        }
                        .city-image img {
                            max-width: 100%;
                            border-radius: 10px;
                        }
                        .additional-info {
                            background-color: #fff;
                            padding: 20px;
                            border-radius: 10px;
                            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
                            margin-bottom: 20px;
                        }
                        .go-back-container {
                            text-align: center;
                        }
                        .go-back-button a {
                            text-decoration: none;
                            color: #fff;
                            display: inline-block;
                            padding: 0.5rem 1rem;
                            margin-bottom: 0;
                            font-size: 1rem;
                            font-weight: 400;
                            line-height: 1.25;
                            text-align: center;
                            vertical-align: middle;
                            cursor: pointer;
                            border: 1px solid transparent;
                            border-radius: 0.25rem;
                            background-color: #007bff;
                            border-color: #007bff;
                        }
                        
                        .go-back-button a:hover {
                            background-color: #0056b3;
                            border-color: #0056b3;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="weather-container">
                            <h2>${city} Weather</h2>
                            <div class="weather-info">
                                <div class="left-container">
                                    <p>Temperature: ${temp}°C</p>
                                    <p>Feels like: ${feels}°C</p>
                                    <p>Humidity: ${humidity}%</p>
                                    <p>Pressure: ${pressure} hPa</p>
                                    <p>Wind Speed: ${windSpeed} m/s</p>
                                    <p>Rain Volume (last 1h): ${rainVolume} mm</p>
                                    <img src='${iconURL}' alt='Weather Icon'>
                                    <p>${desc}</p>
                                </div>
                                <div class="right-container">
                                <div class="map-container" id="map"></div> 
                                </div>
                            </div>
                        </div>
                        
                    </div>
                    <div class="container">
                        <div class="city-image">
                            <img src="${imageUrl}" alt="${city} Image">
                        </div>
                    </div>
                    <div class="container">
                        <div class="additional-info">
                            <h3>Random Cat Fact:</h3>
                            <p>${catFact}</p>
                        </div> 
                        <div class="go-back-container">
                            <button type="submit" class="go-back-button"><a href='/'>Go back</a></button>
                        </div>
                    </div>
                    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
                    <script>
                        var mymap = L.map('map').setView([${coords.lat}, ${coords.lon}], 13);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© OpenStreetMap contributors'
                        }).addTo(mymap);
                        L.marker([${coords.lat}, ${coords.lon}]).addTo(mymap)
                            .bindPopup('${city}')
                            .openPopup();
                    </script>
                </body>
                </html>

            `);
            res.send();
            
            } catch (catFactsError) {
                console.error(catFactsError);
                res.send("Error fetching cat facts.");
            }
        } catch (unsplashError) {
            console.error(unsplashError);
            res.send("Error fetching image data.");
        }
    } catch (weatherError) {
        console.error(weatherError);
        res.send("Error fetching weather data.");
    }
});


app.get("/logout", function (req, res) {
    req.session.destroy();
    res.redirect("/");
});


app.get("/", function (req, res) {
    res.render("index");
});

 
app.listen(3000, function () {
    console.log("Server is running on port 3000");
});
