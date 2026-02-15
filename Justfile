
set dotenv-load
set dotenv-required

localbuild:
    npm run build
    mkdir -p ${VAULT}/.obsidian/plugins/obsidian-genes
    cp main.js ${VAULT}/.obsidian/plugins/obsidian-genes/
    cp manifest.json ${VAULT}/.obsidian/plugins/obsidian-genes/
