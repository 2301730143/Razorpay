const express = require('express');
const cookieParser = require('cookie-parser');

require('dotenv').config();

const app = express();
const PORT = 7002;

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Route modules
const onboardingsRouter = require('./routes/onboardings');
const rolesRouter = require('./routes/roles');
const employeesRouter = require('./routes/employees');
const reimbursementsRouter = require('./routes/reimbursements');

app.use('/rest/onboardings', onboardingsRouter);
app.use('/rest/roles', rolesRouter);
app.use('/rest/employees', employeesRouter);
app.use('/rest/reimbursements', reimbursementsRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running strictly on port ${PORT}`);
});
