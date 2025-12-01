const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// GET handler for testing the endpoint in a browser
app.get('/shopify-webhook', (req, res) => {
  res.send('Shopify webhook endpoint is live!');
});

// Klaviyo API key from Railway environment variables
const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;

// POST handler for Shopify webhook
app.post('/shopify-webhook', async (req, res) => {
  try {
    const customer = req.body;
    const email = customer.email;
    let birthday = null;

    // Debug: log the whole metafields object
    console.log('Metafields:', JSON.stringify(customer.metafields, null, 2));

    // Check for metafields as a flat object (facts.birth_date)
    if (customer.metafields && customer.metafields['facts.birth_date']) {
      birthday = customer.metafields['facts.birth_date'];
      console.log('Found birthday in flat object:', birthday);
    }
    // Or as an array (for other Shopify setups)
    else if (customer.metafields && Array.isArray(customer.metafields)) {
      const bdayField = customer.metafields.find(
        m => m.namespace === 'facts' && m.key === 'birth_date'
      );
      if (bdayField) {
        birthday = bdayField.value;
        console.log('Found birthday in array:', birthday);
      }
    }

    if (email && birthday) {
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
          'Accept': 'application/json'
        }
      });
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

// Explicitly use port 8080 for Railway
const PORT = 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
