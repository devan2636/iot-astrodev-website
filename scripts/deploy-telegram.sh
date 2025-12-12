#!/bin/bash

echo "🚀 Deploying Telegram Integration to Supabase"
echo "=============================================="

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Deploy telegram-notifications function
echo "📤 Deploying telegram-notifications function..."
supabase functions deploy telegram-notifications

if [ $? -eq 0 ]; then
    echo "✅ telegram-notifications function deployed successfully!"
else
    echo "❌ Failed to deploy telegram-notifications function"
    exit 1
fi

# Deploy updated mqtt-data-handler function
echo "📤 Deploying mqtt-data-handler function..."
supabase functions deploy mqtt-data-handler

if [ $? -eq 0 ]; then
    echo "✅ mqtt-data-handler function deployed successfully!"
else
    echo "❌ Failed to deploy mqtt-data-handler function"
    exit 1
fi

# Set environment variables
echo "🔧 Setting environment variables..."
echo "Please run these commands manually to set your environment variables:"
echo ""
echo "supabase secrets set TELEGRAM_BOT_TOKEN=8132058716:AAF6wQGdPJBi46emnzCn74RYOwtmFaPxStI"
echo "supabase secrets set TELEGRAM_CHAT_ID=8164555966"
echo ""

echo "=============================================="
echo "🎉 Deployment completed!"
echo ""
echo "Next steps:"
echo "1. Set the environment variables above"
echo "2. Test the functions with: python examples/telegram-testing/test_telegram.py"
echo "3. Send test MQTT data to verify end-to-end flow"
