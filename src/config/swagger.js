const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'DogMart API Documentation',
            version: '1.0.0',
            description: 'API documentation for the DogMart AWS Migration',
        },
        servers: [
            {
                url: process.env.API_URL || 'http://localhost:3001',
                description: 'Development Server',
            },
            {
                url: 'http://65.2.129.246:3001',
                description: 'Production Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./src/routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
