
set dotenv-load
set dotenv-required

localbuild:
    npm run build
    cp main.js ${VAULT}/.obsidian/plugins/obsidian-genes/

