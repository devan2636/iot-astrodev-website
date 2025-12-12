export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_active: boolean
          key_value: string
          name: string
          permissions: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          is_active?: boolean
          key_value: string
          name: string
          permissions?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          key_value?: string
          name?: string
          permissions?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      devices: {
        Row: {
          battery: number
          created_at: string
          description: string | null
          id: string
          latitude: number | null
          location: string
          longitude: number | null
          mac: string
          name: string
          serial: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          battery?: number
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          location: string
          longitude?: number | null
          mac: string
          name: string
          serial: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          battery?: number
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          mac?: string
          name?: string
          serial?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      protocol_settings: {
        Row: {
          created_at: string
          id: number
          settings: Json
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          id?: number
          settings?: Json
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          id?: number
          settings?: Json
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      sensor_readings: {
        Row: {
          battery: number | null
          device_id: string
          humidity: number | null
          id: string
          pressure: number | null
          sensor_data: Json | null
          temperature: number | null
          timestamp: string
        }
        Insert: {
          battery?: number | null
          device_id: string
          humidity?: number | null
          id?: string
          pressure?: number | null
          sensor_data?: Json | null
          temperature?: number | null
          timestamp?: string
        }
        Update: {
          battery?: number | null
          device_id?: string
          humidity?: number | null
          id?: string
          pressure?: number | null
          sensor_data?: Json | null
          temperature?: number | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensor_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_device_access_details_view"
            referencedColumns: ["device_actual_id"]
          },
        ]
      }
      sensors: {
        Row: {
          created_at: string
          description: string | null
          device_id: string
          id: string
          is_active: boolean
          max_value: number | null
          min_value: number | null
          name: string
          type: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          device_id: string
          id?: string
          is_active?: boolean
          max_value?: number | null
          min_value?: number | null
          name: string
          type: string
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          device_id?: string
          id?: string
          is_active?: boolean
          max_value?: number | null
          min_value?: number | null
          name?: string
          type?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensors_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensors_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_device_access_details_view"
            referencedColumns: ["device_actual_id"]
          },
        ]
      }
      user_device_access: {
        Row: {
          created_at: string
          device_id: string
          granted_by: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          granted_by: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          granted_by?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_device_access_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_device_access_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_device_access_details_view"
            referencedColumns: ["device_actual_id"]
          },
          {
            foreignKeyName: "user_device_access_user_id_fk_to_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_device_access_user_id_fk_to_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_device_access_details_view"
            referencedColumns: ["profile_actual_id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      device_status: {
        Row: {
          id: string
          device_id: string
          status: 'online' | 'offline'
          battery: number
          wifi_rssi: number
          uptime: number
          free_heap: number
          ota_update: string | null
          timestamp: string
          created_at: string
          sensor_data: Json | null
        }
        Insert: {
          id?: string
          device_id: string
          status?: 'online' | 'offline'
          battery?: number
          wifi_rssi?: number
          uptime?: number
          free_heap?: number
          ota_update?: string | null
          timestamp?: string
          created_at?: string
          sensor_data?: Json | null
        }
        Update: {
          id?: string
          device_id?: string
          status?: 'online' | 'offline'
          battery?: number
          wifi_rssi?: number
          uptime?: number
          free_heap?: number
          ota_update?: string | null
          timestamp?: string
          created_at?: string
          sensor_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "device_status_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      user_device_access_details_view: {
        Row: {
          created_at: string | null
          device_actual_id: string | null
          device_id: string | null
          device_location: string | null
          device_name: string | null
          granted_by: string | null
          id: string | null
          profile_actual_id: string | null
          profile_username: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_device_access_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_device_access_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_device_access_details_view"
            referencedColumns: ["device_actual_id"]
          },
          {
            foreignKeyName: "user_device_access_user_id_fk_to_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_device_access_user_id_fk_to_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_device_access_details_view"
            referencedColumns: ["profile_actual_id"]
          },
        ]
      }
      user_details: {
        Row: {
          id: string
          email: string | null
          email_confirmed_at: string | null
          created_at: string | null
          username: string | null
          role: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_accessible_devices: {
        Args: { user_id: string }
        Returns: {
          device_id: string
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: { user_id: string; permission_name: string }
        Returns: boolean
      }
      validate_sensor_data: {
        Args: { device_uuid: string; data: Json }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "superadmin" | "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["superadmin", "admin", "user"],
    },
  },
} as const
