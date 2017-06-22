var nodemailer = require('nodemailer');
var credentials = require('../credentials.js');
module.exports = function(credentials){
    var mailTransport = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: credentials.gmail.user,
            pass: credentials.gmail.password,
        }
    });// console.log(credentials.gmail.user);
    var from = '"Meadowlark" <info@meadowlark.com>';
    var errorRecipient = '1hsunc@gmail.com';

    return {
        send: function(to, subj, body){
            mailTransport.sendMail({
                form: from,
                to: to,
                subject: subj,
                // text:'How do you turn this on.'
                html: body,
                generateTextFromHtml: true,
            }, function (err) {
                if (err) console.error('Unable to send mails: ' + error);
            });
        },
        emailError: function(message,filename,exception){
            var body = '<h1>Meadowlark Travel Site Error</h1>' +
                'message:<br><pre>' + message + '</pre><br>';
            if (exception) body += 'exception:<br><pre>' + exception
                + '</pre><br>';
            if (filename) body += 'filename:<br><pre>' + filename
                + '</pre><br>';
            mailTransport.sendMail({
                from: from,
                to: errorRecipient,
                subject: 'Meadowlark Site Error',
                html: body,
                generateTextFromHtml: true
            }, function (err) {
                if (err) console.error('Unable to send email: ' + err);
            });
        }
    }    
}
var mailTransport = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: credentials.gmail.user,
        pass: credentials.gmail.password,
    }
});// console.log(credentials.gmail.user);
// var from = '"Meadowlark" <info@meadowlark.com>';
// mailTransport.sendMail({
//     from:from,
//     to:'1hsunc@gmail.com',
//     subject:'Testing',
//     text:'words words words.',
// },function(err){
//     if(err) console.error('Failed for mail sending: '+err);
// });
