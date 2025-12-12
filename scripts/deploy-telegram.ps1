Write-Host "🚀 Deploying Telegram Integration to Supabase" -ForegroundColor Cyan
Write-Host "=============================================="

# Check if supabase CLI is installed
if (!(Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g supabase"
    exit 1
}

# Deploy telegram-notifications function
Write-Host "📤 Deploying telegram-notifications function..." -ForegroundColor Yellow
supabase functions deploy telegram-notifications

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ telegram-notifications function deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to deploy telegram-notifications function" -ForegroundColor Red
    exit 1
}

# Deploy updated mqtt-data-handler function
Write-Host "📤 Deploying mqtt-data-handler function..." -ForegroundColor Yellow
supabase functions deploy mqtt-data-handler

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ mqtt-data-handler function deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to deploy mqtt-data-handler function" -ForegroundColor Red
    exit 1
}

# Set environment variables
Write-Host "`n🔧 Setting environment variables..." -ForegroundColor Yellow
Write-Host "Please run these commands manually to set your environment variables:"
Write-Host ""
Write-Host "supabase secrets set TELEGRAM_BOT_TOKEN=8132058716:AAF6wQGdPJBi46emnzCn74RYOwtmFaPxStI"
Write-Host "supabase secrets set TELEGRAM_CHAT_ID=8164555966"
Write-Host ""

Write-Host "=============================================="
Write-Host "🎉 Deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Set the environment variables above"
Write-Host "2. Test the functions with: python examples/telegram-testing/test_telegram.py"
Write-Host "3. Send test MQTT data to verify end-to-end flow"
