const express = require('express');

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hej fra Express!');
});

app.listen(port, () => {
  console.log(`Serveren kører på http://localhost:${port}`);
});