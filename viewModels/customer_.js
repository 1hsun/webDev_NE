var _ = require('underscore');

function getCustomerViewModel(customerId){
  var customer = Customer.findById(customerId);
  if(!customer) return { error:'Unknown ID: '+req.params.customerId };
  var orders = customer.getOrders().map(function(order){
    return {
      orderNumber: order.orderNumber,
      date:orde.date,
      status:order.status,
      url:'/orders/'+order.orderNumber,
    }
  });
  var vm = _.omit(customer,'salesNotes');//date,salespersonId,notes
  return _.extend(vm, {
    name: smartJoin([vm.firstName,vm.lastName]),
    fullAddress: smartJoin([
      customer.address1,
      customer.address2,
      customer.city+','+customer.state+','+customer.zip,
    ],'<br>'),
    orders:customer.getOrders().map(function(order){
      return {
        orderNumber:order.orderNumber,
        date:order.date,
        status:order.status,
        url:'/orders/'+order.orderNumber,
      }
    }),
  });
}