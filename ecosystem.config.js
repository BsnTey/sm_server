module.exports = {
    apps: [
        {
            name: 'sport_sm_server',
            script: 'dist/main.js',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            env: {
                NODE_ENV: 'development',
            },
            env_production: {
                NODE_ENV: 'production',
            },
            env_file: './.env',
            max_memory_restart: '5000M',
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            merge_logs: true,
            restart_delay: 5000,
        },
    ],
};
