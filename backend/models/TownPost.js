const mongoose = require('mongoose');

const TownPostSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  content: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  postType: { type: String, enum: ['Update', 'Issue'], required: true },
  status: { type: String, enum: ['Reported', 'Acknowledged', 'Resolved'], default: 'Reported' },
  servantReply: { type: String, default: '' },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
  createdAt: { type: Date, default: Date.now }
});

TownPostSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('TownPost', TownPostSchema);
