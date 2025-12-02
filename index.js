const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// GET handler for browser testing
app.get('/shopify-webhook', (req, res) => {
  res.send('Shopify webhook endpoint is live!');
});

// Environment variables (set these in Railway dashboard)
const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_PASSWORD = process.env.SHOPIFY_API_PASSWORD; // This is your Admin API access token
const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP; // e.g. yourstore.myshopify.com

app.post('/shopify-webhook', async (req, res) => {
  try {
    const customer = req.body;
    const email = customer.email;
    const customerId = customer.id;
    let birthday = null;

    // Fetch customer metafields from Shopify Admin API
    if (customerId) {
      const url = `https://${SHOPIFY_SHOP}/admin/api/2023-10/customers/${customerId}/metafields.json`;
      const response = await axios.get(url, {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_API_PASSWORD,
          'Content-Type': 'application/json'
        }
      });
      const metafields = response.data.metafields;
      // Debug: print all metafields
      console.log('Fetched metafields:', JSON.stringify(metafields, null, 2));
      const bdayField = metafields.find(
        m => m.namespace === 'facts' && m.key === 'birth_date'
      );
      if (bdayField) {
        birthday = bdayField.value;
        console.log('Fetched birthday from Shopify API:', birthday);
      }
    }

    if (email && birthday) {

console.log('Sending to Klaviyo:', JSON.stringify({
  data: {
    type: 'profile',
    attributes: {
      email: email,
      properties: {
        Birthday: birthday
      }
    }
  }
}, null, 2));

   await axios.post('https://a.klaviyo.com/api/profiles/', {
  data: {
    type: 'profile',
    attributes: {
      email: email,
      properties: {
        Birthday: birthday
      }
    }
  }
}, {
  headers: {
    'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'revision': '2023-10-15'
  }
});

// Trigger redeploy


      console.log(`Synced birthday for ${email}: ${birthday}`);
    } else {
      console.log(`No birthday to sync for ${email}`);
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error syncing to Klaviyo:', err.response?.data || err.message);
    res.status(500).send('Error');
  }
});

// Use port 8080 for Railway
const PORT = 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
