var mongoose = require('mongoose');
var orderSchema = mongoose.Schema({
  //Pending
});
var Order = mongoose.model('Order',orderSchema);
module.exports = Order;