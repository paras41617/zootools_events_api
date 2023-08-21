const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());

// Simulated in-memory storage for events, opensByCountries, opensByDevice, and timeseries
const eventsStorage = [];
const opensByCountries = {};
const opensByDevice = {};
const timeseriesMap = {};

// Endpoint for receiving real-time events
app.post('/events', (req, res) => {
  const event = req.body;
  eventsStorage.push(event);

  // Aggregating opens by countries
  const country = event.geo_ip.country;
  opensByCountries[country] = (opensByCountries[country] || 0) + 1;

  // Aggregating opens by device
  const deviceType = event.user_agent_parsed.device_family.toLowerCase();
  opensByDevice[deviceType] = (opensByDevice[deviceType] || 0) + 1;

  // Extracting and formatting the timestamp
  const timestamp = parseInt(event.timestamp) * 1000;
  const roundedTime = new Date(Math.floor(timestamp / 60000) * 60000).toLocaleString('en-US');

  // Filling gaps in timeseriesMap
  if (!timeseriesMap[roundedTime]) {
    fillTimeSeriesGaps(roundedTime);
  }

  // Increment timeseriesMap value
  timeseriesMap[roundedTime] = (timeseriesMap[roundedTime] || 0) + 1;

  res.status(201).json({ message: 'Event received successfully' });
});

// Function to fill gaps in timeseriesMap
function fillTimeSeriesGaps(roundedTime) {
  const timestamps = Object.keys(timeseriesMap).map(time => new Date(time).getTime());
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);

  for (let timestamp = minTimestamp; timestamp <= maxTimestamp; timestamp += 60000) {
    const time = new Date(Math.floor(timestamp / 60000) * 60000).toLocaleString('en-US');
    if (!timeseriesMap[time]) {
      timeseriesMap[time] = 0;
    }

    if (time === roundedTime) {
      break;
    }
  }
}

// Endpoint for aggregating metrics
app.get('/metrics', (req, res) => {
  // Fill gaps in timeseriesMap before responding
  const timestamps = Object.keys(timeseriesMap);
  timestamps.forEach(time => {
    fillTimeSeriesGaps(time);
  });

  const timeseries = Object.keys(timeseriesMap).map(time => ({ totalOpens: timeseriesMap[time], time }));

  // Sort the timeseries array by time
  timeseries.sort((a, b) => new Date(a.time) - new Date(b.time));

  res.json({
    opens_by_countries: opensByCountries,
    opens_by_device: opensByDevice,
    timeseries: timeseries
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;