var sql = require('mssql');

module.exports = {
    check: () => sql.connect(require("./config"))
        .then(() =>
            sql.query `SELECT TOP 1 FROM Notifications`
            .then((recordset) => console.dir(recordset))
            .catch((err) => console.log('Couldn\'t query', err))
        ).catch((err) => console.log('Couldn\'t connect', err))
};