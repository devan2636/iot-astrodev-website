# Device Status Testing

This directory contains tools to test device status saving functionality.

## Problem

The MQTT device status data is being received but not saved to the database. The sensor data is saved successfully, but device status is not.

## Root Cause

The issue is that the MQTT data handler function (`supabase/functions/mqtt-data-handler/index.ts`) needs to be deployed to Supabase and properly configured to handle incoming MQTT messages.

## Solution Steps

### 1. Deploy MQTT Data Handler Function

First, deploy the function to Supabase:

```bash
# Navigate to your project root
cd /path/to/your/project

# Deploy the function
supabase functions deploy mqtt-data-handler
```

### 2. Configure Environment Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 3. Test the Function

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the test:

```bash
python test_status_save.py
```

### 4. Configure MQTT Bridge

The MQTT bridge needs to call the data handler function when receiving messages. Update your MQTT configuration to point to the deployed function.

## Expected Behavior

When working correctly:

1. MQTT messages are received on topics like `iot/devices/{device_id}/status`
2. The MQTT data handler function processes the message
3. Device status is saved to the `device_status` table
4. The `devices` table is updated with the latest status
5. Real-time updates are broadcast to connected clients
6. The monitoring dashboard shows updated device status

## Troubleshooting

### Function Not Found (404)

- Make sure the function is deployed: `supabase functions deploy mqtt-data-handler`
- Check the function URL in Supabase dashboard

### Permission Denied (403)

- Verify your SUPABASE_ANON_KEY is correct
- Check RLS policies on `device_status` table

### Database Errors

- Ensure the `device_status` table exists
- Run migrations: `supabase db push`
- Check that device IDs exist in the `devices` table

### MQTT Connection Issues

- Verify MQTT broker credentials
- Check network connectivity
- Ensure topics match the expected format: `iot/devices/{device_id}/status`

## Files

- `test_status_save.py` - Test script to verify function works
- `requirements.txt` - Python dependencies
- `.env.example` - Environment variables template
- `README.md` - This documentation
