const express = require('express');
const app = express();

app.get('/shopify-webhook', (req, res) => {
  res.send('Shopify webhook endpoint is live!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
