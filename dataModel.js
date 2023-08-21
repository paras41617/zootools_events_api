const mongoose = require('mongoose');

const TimeseriesSchema = new mongoose.Schema({
  totalOpens: Number,
  time: Date,
});

const DataSchema = new mongoose.Schema({
  opens_by_countries: {
    type: Map,
    of: Number,
    default: {},
  },
  opens_by_device: {
    type: Map,
    of: Number,
    default: {},
  },
  timeseries: [TimeseriesSchema],
});

const DataModel = mongoose.model('Data', DataSchema);

module.exports = DataModel;
