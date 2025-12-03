const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// GET handler for browser testing
app.get('/shopify-webhook', (req, res) => {
  res.send('Shopify webhook endpoint is live!');
});

// Environment variables
const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;
const SHOPIFY_API_PASSWORD = process.env.SHOPIFY_API_PASSWORD;
const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;

// Function to fetch metafields from Shopify
async function fetchMetafields(customerId) {
  const url = `https://${SHOPIFY_SHOP}/admin/api/2023-10/customers/${customerId}/metafields.json`;
  const response = await axios.get(url, {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_API_PASSWORD,
      'Content-Type': 'application/json'
    }
  });
  return response.data.metafields;
}

// Function to set a metafield value
async function setMetafield(customerId, namespace, key, value, type = 'single_line_text_field') {
  const url = `https://${SHOPIFY_SHOP}/admin/api/2023-10/customers/${customerId}/metafields.json`;
  
  try {
    await axios.post(url, {
      metafield: {
        namespace: namespace,
        key: key,
        value: value,
        type: type
      }
    }, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_API_PASSWORD,
        'Content-Type': 'application/json'
      }
    });
    console.log(`Set metafield ${namespace}.${key} = ${value}`);
    return true;
  } catch (err) {
    console.error(`Error setting metafield ${namespace}.${key}:`, err.response?.data || err.message);
    return false;
  }
}

// Function to sync to Klaviyo
async function syncToKlaviyo(email, birthday, gender) {
  if (!email || (!birthday && !gender)) {
    console.log(`No data to sync for ${email}`);
    return;
  }

  const properties = {};
  
  // Convert birthday text to date format if it exists
  if (birthday) {
    // Try to parse "June 26, 1969" format to "1969-06-26"
    try {
      const date = new Date(birthday);
      if (!isNaN(date.getTime())) {
        properties.birthday = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        console.log('Converted birthday to:', properties.birthday);
      } else {
        properties.birthday = birthday; // Keep as-is if parsing fails
      }
    } catch (e) {
      properties.birthday = birthday;
    }
  }
  
  if (gender) properties.gender = gender;

  console.log('Sending to Klaviyo:', JSON.stringify({
    data: {
      type: 'identify',
      attributes: {
        email: email,
        properties: properties
      }
    }
  }, null, 2));

  try {
    await axios.post('https://a.klaviyo.com/api/identify', {
      data: {
        type: 'identify',
        attributes: {
          email: email,
          properties: properties
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
    console.log('Klaviyo Identify response: Success');
    console.log(`Synced data for ${email}: birthday=${properties.birthday}, gender=${properties.gender}`);
  } catch (err) {
    console.error('Error syncing to Klaviyo:', err.response?.data || err.message);
  }
}

  }, null, 2));

  try {
    await axios.post('https://a.klaviyo.com/api/identify', {
      data: {
        type: 'identify',
        attributes: {
          email: email,
          properties: properties
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
    console.log('Klaviyo Identify response: Success');
    console.log(`Synced data for ${email}: birthday=${birthday}, gender=${gender}`);
  } catch (err) {
    console.error('Error syncing to Klaviyo:', err.response?.data || err.message);
  }
}

// Webhook for Customer Update (existing)
app.post('/shopify-webhook', async (req, res) => {
  try {
    const customer = req.body;
    const email = customer.email;
    const customerId = customer.id;
    let birthday = null;
    let gender = null;

    if (customerId) {
      const metafields = await fetchMetafields(customerId);
      console.log('Fetched metafields:', JSON.stringify(metafields, null, 2));

      const bdayField = metafields.find(
        m => m.namespace === 'facts' && m.key === 'birth_date'
      );
      if (bdayField) {
        birthday = bdayField.value;
        console.log('Fetched birthday from Shopify API:', birthday);
      }

      const genderField = metafields.find(
        m => m.namespace === 'custom' && m.key === 'gender'
      );
      if (genderField) {
        gender = genderField.value;
        console.log('Fetched gender from Shopify API:', gender);
      }
    }

    await syncToKlaviyo(email, birthday, gender);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error in /shopify-webhook:', err.message);
    res.status(500).send('Error');
  }
});

// Webhook for Customer Created (new registrations)
app.post('/shopify-webhook-register', async (req, res) => {
  try {
    const customer = req.body;
    const email = customer.email;
    const customerId = customer.id;
    
    console.log('New customer registration:', email);

    // Wait a moment for Shopify to process the form data
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Fetch metafields to see if Shopify saved them
    let birthday = null;
    let gender = null;

    if (customerId) {
      const metafields = await fetchMetafields(customerId);
      console.log('Fetched metafields on registration:', JSON.stringify(metafields, null, 2));

      // Look for birthday in custom.registration_birthday
      const bdayField = metafields.find(
        m => m.namespace === 'custom' && m.key === 'registration_birthday'
      );
      if (bdayField) {
        birthday = bdayField.value;
        console.log('Found birthday in metafields:', birthday);
      }

      // Look for gender in custom.gender
      const genderField = metafields.find(
        m => m.namespace === 'custom' && m.key === 'gender'
      );
      if (genderField) {
        gender = genderField.value;
        console.log('Found gender in metafields:', gender);
      }
    }

    // Sync to Klaviyo
    await syncToKlaviyo(email, birthday, gender);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error in /shopify-webhook-register:', err.message);
    res.status(500).send('Error');
  }
});


// Use port 8080 for Railway
const PORT = 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));