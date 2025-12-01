const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

app.get('/shopify-webhook', (req, res) => {
  res.send('Shopify webhook endpoint is live!');
});


const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;

app.post('/shopify-webhook', async (req, res) => {
  try {
    const customer = req.body;
    const email = customer.email;
    let birthday = null;

    if (customer.metafields && Array.isArray(customer.metafields)) {
      const bdayField = customer.metafields.find(
        m => m.namespace === 'facts' && m.key === 'birth_date'
      );
      if (bdayField) birthday = bdayField.value;
    } else if (customer.metafields && customer.metafields['facts.birth_date']) {
      birthday = customer.metafields['facts.birth_date'];
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
