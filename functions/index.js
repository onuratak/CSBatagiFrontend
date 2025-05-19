const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.sendNotification = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
        // Send response to OPTIONS requests
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    try {
        const { notification, data, tokens } = req.body;

        if (!notification || !tokens || !Array.isArray(tokens)) {
            throw new Error('Invalid request body');
        }

        const message = {
            notification,
            data,
            tokens
        };
        console.log("Tokens array:", tokens);
        const response = await admin.messaging().sendMulticast(message);
        
        console.log('Successfully sent message:', response);
        res.status(200).json({ success: true, response });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}); 