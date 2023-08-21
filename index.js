const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const DataModel = require('./dataModel'); // Path to the schema file
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

app.use(bodyParser.json());

// Endpoint for receiving real-time events
app.post('/events', async (req, res) => {
    const event = req.body;
    try {
        // Find the default data document
        let data = await DataModel.findOne();
        const country = event.geo_ip.country;
        const deviceType = event.user_agent_parsed.device_family.toLowerCase();
        const timestamp = parseInt(event.timestamp) * 1000;
        const roundedTime = new Date(Math.floor(timestamp / 60000) * 60000).toLocaleString('en-US');


        if (!data) {
            // If no data found, create a new default document
            data = new DataModel({
                opens_by_device: {},
                opens_by_countries: {},
                timeseries: []
            });
        }

        if (deviceType) {
            data.opens_by_device.set(deviceType, (data.opens_by_device.get(deviceType) || 0) + 1);
        }

        // Update opens_by_countries field
        if (country) {
            data.opens_by_countries.set(country, (data.opens_by_countries.get(country) || 0) + 1);
        }
        try {
            const existingDataPoint = data.timeseries.find(point => point.time.toLocaleString('en-US') === roundedTime);
            if (existingDataPoint) {
                // If exists, update the totalOpens count
                existingDataPoint.totalOpens += 1;
            } else {
                // If not, create a new time series data point
                fillTimeSeriesGaps(roundedTime, data);
                data.timeseries.push({
                    time: roundedTime,
                    totalOpens: 1
                });
            }

            // Save the updated data
        }
        catch {
            data.timeseries.push({
                time: roundedTime,
                totalOpens: 1
            });
        }
        await data.save();

        res.status(200).json({ message: 'Data updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred.' });
    }
});

// Function to fill gaps in timeseriesMap
function fillTimeSeriesGaps(roundedTime, data) {
    if (data.timeseries === []) {
        return;
    }
    const maxTimestamp = Date.parse(data.timeseries[data.timeseries.length - 1].time);
    if (maxTimestamp !== roundedTime) {
        for (let timestamp = (maxTimestamp + 60000); timestamp <= Date.parse(roundedTime) - 60000; timestamp += 60000) {
            const time = new Date(Math.floor(timestamp / 60000) * 60000).toLocaleString('en-US');
            data.timeseries.push({
                time: time,
                totalOpens: 0
            });
        }
    }
}

// Endpoint for aggregating metrics
app.get('/metrics', async (req, res) => {
    try {
        // Find the default data document
        const data = await DataModel.findOne();

        if (!data) {
            res.status(404).json({ message: 'No data found.' });
            return;
        }

        // Prepare the response structure
        const response = {
            opens_by_countries: data.opens_by_countries,
            opens_by_device: data.opens_by_device,
            timeseries: data.timeseries.map(point => ({
                totalOpens: point.totalOpens,
                time: point.time.toLocaleString('en-US', { timeZone: 'UTC' })
            }))
        };

        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;