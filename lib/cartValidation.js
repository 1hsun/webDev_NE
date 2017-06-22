module.exports = {
    checkWaivers: function(req,res,next){
        var cart = req.session.cart;
        if(!cart) return next();
        if(cart.some(function(i) {return i.product.requiresWaiver;} ))
        {
            if(!cart.warnings) cart.warnings = [];
            cart.warnings.push('One or more items requires a waiver.');
        }
        next();
    },
    checkGuestCounts:function(req,res,next){
        var cart = req.session.cart;
        if(!cart) return next();
        if(cart.some(function(item){ return item.guests > item.product.maximumGuests }));
        {
            if(!cart.errors) cart.errors = [];
            cart.errors.push('One or more your selected items cannot accommodate the number of guests you have selected.');
        }
        next();
    }
};