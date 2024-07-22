const {Connection, Request} = require("tedious");
const fs = require('fs')
const executeSQL = (sql, callback) => {
  let connection = new Connection({
    "authentication": {
      "options": {
        userName: "user",
        password: "password",
      },
      "type": "default"
    },
    "server": "127.0.0.1",
    "options": {
      "validateBulkLoadParameters": false,
      "rowCollectionOnRequestCompletion": true,
        trustServerCertificate: true,
        database:"database_name"
    }
  });
  connection.connect((err) => {
    if (err)
      return callback(err, null);
    const request = new Request(sql, (err, rowCount, rows) => {
      connection.close();
      if (err)
        return callback(err, null);
      callback(null, {rowCount, rows});
    });
    connection.execSql(request);
  });
};

// USAGE EXAMPLE:
/*let tables = []
executeSQL("SELECT * FROM tbl_Carriers", (err, data) => {
  if (err)
    console.error(err);
  console.log(data.rowCount);
});
//or
executeSQL("SELECT * FROM tbl_Carriers", (err, {rowCount, rows}) => {
  if (err)
    console.error(err);
  console.log(rowCount);
  console.log(rows)

});*/




const migrator = {
    tables:[],
    structure:[],
    sql:'',
    segregateTableType: (type) => {
        switch(type) {
            case "nvarchar": return "VARCHAR";
            case "nchar": return "CHAR";
            case "datetime2": 
            case "datetime":
            case "date":
            return "TIMESTAMP"
            case "money":
                return "DECIMAL"
            default: return type
        }
    },
    create_table: (name, table_schema) => {
        console.log(table_schema)
        console.log(table_schema.length)
        let sql = `CREATE TABLE ${name} (
    ${table_schema.map((item, index) => {
                if (index < table_schema.length-1) {
                    if (item.size < 0) {
                        return "\t"+item.field+" "+item.type.toUpperCase()+"_COMMA_ \n"
                    }
                    if (item.type == 'int') {
                      if (item.primary) {
                        return  "\t"+item.field+" "+item.type.toUpperCase()+" GENERATED ALWAYS AS IDENTITY PRIMARY KEY_COMMA_ \n"
                      } else
                        return "\t"+item.field+" "+item.type.toUpperCase()+"_COMMA_ \n"
                    }

                    if (item.type == 'TIMESTAMP') {
                        return "\t"+item.field+" "+item.type.toUpperCase()+"_COMMA_ \n"
                    }
                  
                    return "\t"+item.field+" "+item.type.toUpperCase()+"("+item.size+")_COMMA_ \n"
                } else {
                    if (item.size < 0) {
                        return "\t"+item.field+" "+item.type.toUpperCase()
                    }
                    if (item.type == 'int') {
                        return "\t"+item.field+" "+item.type.toUpperCase()
                    }
                    if (item.type == "TIMESTAMP") {
                        return "\t"+item.field+" "+item.type.toUpperCase()
                    }
                    
                    return "\t"+item.field+" "+item.type.toUpperCase()+"("+item.size+")"
                }
                
            })}
        );`
        sql = sql.replaceAll(",", "")
        sql = sql.replaceAll("_COMMA_", ",")
        migrator.sql += sql+"\n"
      },
      findFieldIndex: (table, fieldName) => {
        for(let i = 0; i < table.length; i++) {
          if (table[i].field == fieldName) return i;
        }
        return -1;
      },
      getAllTables: async () => {
        return new Promise((resolve, reject) => {
            executeSQL("SELECT name FROM sys.Tables;", (err, {rowCount, rows}) => {
                //console.log(rows)
                //console.log(rows.length)
                rows.map((item) => {
                    //console.log(item[0].value)
                    migrator.tables.push(item[0].value)
                })
                console.log(migrator.tables)
                resolve(true)
            })
        })
       
      
      },
      createSqlStructure: async () => {
        console.log("createSqlStructure execution...")
        return new Promise((resolve, reject) => {
            const keys = Object.keys(migrator.structure)
            keys.map((key) => {
                migrator.create_table(key, migrator.structure[key])
            })
          

            resolve(true)
        })
        
      },
      createTableMap: async (table_name) => {
        return new Promise((resolve, reject) => {
            console.log(`EXEC sp_help '${table_name}';`)
            executeSQL(`EXEC sp_help '${table_name}';`, (err, {rowCount, rows}) => {
                //console.log(rows)
                let table = []
                rows.map((item) => {
                    item.forEach((column) => {
                        //console.log(column)
                        if (column.metadata.colName == "Column_name") {
                            table.push({
                                field:column.value,
                                type:'',
                                size:'',
                                primary:false
                            })
                        }
                        if (column.metadata.colName == "Type") {
                            if (table.length > 0)
                            table[table.length-1].type = migrator.segregateTableType(column.value)
                        }
                        if (column.metadata.colName == "Length") {
                            if (table.length > 0)
                            table[table.length-1].size = column.value

                            
                        }
                        if (column.metadata.colName == "Identity") {
                        const table_id = migrator.findFieldIndex(table, column.value)
                        if (table_id >= 0) {
                            table[table_id].primary = true
                            //table[table_id].type = 'BIGSERIAL'
                        }
                        }
                    })
                })
                
            console.log("createTableMap->table:",table)
            migrator.structure[table_name] = table;
            resolve(true)
            })
        })
        
    },
    mapTables: async () => {
        return new Promise(async (resolve, reject) => {
            for(let i = 0; i < migrator.tables.length; i++) {
                await migrator.createTableMap(migrator.tables[i])
            }
            /*migrator.tables.map((item) => {
                migrator.createTableMap(item)
            })*/
            //console.log("migrator.structure",migrator.structure)
            resolve(true)
        })
      
    },
    createSqlFile: async () => {
        fs.writeFile("./data.sql", migrator.sql, function(err) {
            if (err) console.error(err)
        })
    },
    main: async () => {
        await migrator.getAllTables()

        await migrator.mapTables()

        await migrator.createSqlStructure()

        await migrator.createSqlFile()
    }
}


migrator.main()


/*
executeSQL("EXEC sp_help tbl_Carriers", (err, {rowCount, rows}) => {
    //console.log(rows)

    rows.map((item) => {
        console.log(item)
    })
})
*/