Write-Host "🚀 Deploying Telegram Integration to Supabase"
Write-Host "=============================================="

# Check if supabase CLI is installed
if (!(Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found. Please install it first:"
    Write-Host "   npm install -g supabase"
    exit 1
}

# Deploy telegram-notifications function
Write-Host "📤 Deploying telegram-notifications function..."
supabase functions deploy telegram-notifications

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ telegram-notifications function deployed successfully!"
} else {
    Write-Host "❌ Failed to deploy telegram-notifications function"
    exit 1
}

# Deploy updated mqtt-data-handler function
Write-Host "📤 Deploying mqtt-data-handler function..."
supabase functions deploy mqtt-data-handler

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ mqtt-data-handler function deployed successfully!"
} else {
    Write-Host "❌ Failed to deploy mqtt-data-handler function"
    exit 1
}

# Set environment variables
Write-Host "🔧 Setting environment variables..."

# Set variables directly
Write-Host "Setting TELEGRAM_BOT_TOKEN..."
supabase secrets set --env-file "TELEGRAM_BOT_TOKEN=8132058716:AAF6wQGdPJBi46emnzCn74RYOwtmFaPxStI"

Write-Host "Setting TELEGRAM_CHAT_ID..."
supabase secrets set --env-file "TELEGRAM_CHAT_ID=-4691595195"

Write-Host "=============================================="
Write-Host "🎉 Deployment completed!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Verify environment variables in Supabase Dashboard"
Write-Host "2. Test the functions with: python examples/telegram-testing/test_telegram.py"
Write-Host "3. Send test MQTT data to verify end-to-end flow"
