module.exports = {
    apps: [
      {
        name: "app-instance-1", // Nombre de la primera instancia
        script: "./app.js", // Ruta al script principal de tu app
        instances: 2, // Aquí defines cuántas instancias correr (ejemplo: 2 núcleos)
        exec_mode: "cluster", // Modo cluster para balanceo de carga
        env: {
          NODE_ENV: "production",
          INSTANCE_ID: "1",
          OTHER_VAR: "valor1"
        }
      },
      {
        name: "app-instance-2",
        script: "./app.js",
        instances: 2, // Definiendo varias instancias en modo cluster
        exec_mode: "cluster",          
        env: {
          NODE_ENV: "production",
          INSTANCE_ID: "2",
          OTHER_VAR: "valor2"
        }
      }
    ]
  }