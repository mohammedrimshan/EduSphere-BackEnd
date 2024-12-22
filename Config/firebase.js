const admin = require('firebase-admin');
const serviceAccount = require('./firebase-adminsdk.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://edusphere-4c675-default-rtdb.firebaseio.com",
  });
}

module.exports = admin;
