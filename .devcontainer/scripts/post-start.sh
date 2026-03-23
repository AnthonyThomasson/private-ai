if command -v cursor &> /dev/null; then
    if [ -f ~/.zshrc ]; then
        echo "export GIT_EDITOR=\"cursor --wait\"" >> ~/.zshrc
    elif [ -f ~/.bashrc ]; then
        echo "export GIT_EDITOR=\"cursor --wait\"" >> ~/.bashrc
    else
        echo "export GIT_EDITOR=\"cursor --wait\"" >> ~/.profile
    fi
fi

if [ ! -f .env ]; then
    touch .env
fi

# Check if OPENAI_API_KEY is set in .env
if ! grep -q "OPENAI_API_KEY" .env; then
    echo "OpenAI API key not found in .env file."
    echo "📝 Please enter your OpenAI API key (https://platform.openai.com/api-keys):"
    read api_key
    
    echo "OPENAI_API_KEY=$api_key" >> .env
    echo "🤖 The OpenAI API key has been saved to .env file."
fi 

# Check if DB_FILE_NAME is set in .env
if ! grep -q "DB_FILE_NAME" .env; then
    echo "DB_FILE_NAME=file:data/local.db" >> .env
    echo "💾 The database file has been saved to .env file."
fi

rm -rf local.db
rm -rf public/story/

pnpm install
pnpm db:push