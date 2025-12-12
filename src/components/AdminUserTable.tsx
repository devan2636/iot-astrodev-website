import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MoreHorizontal, 
  Trash2, 
  UserCog, 
  ShieldAlert, 
  Search, 
  Mail,
  Calendar,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const AdminUserTable = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // State untuk User yang sedang login
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  useEffect(() => {
    fetchCurrentUser();
    fetchUsers();
  }, []);

  // Filter fungsi pencarian
  useEffect(() => {
    const filtered = users.filter(user => 
      (user.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setCurrentUserRole(data?.role || 'user');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // MENGGUNAKAN VIEW 'user_details' AGAR EMAIL MUNCUL
      const { data, error } = await supabase
        .from('user_details') 
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Gagal Memuat Data",
        description: "Tidak dapat mengambil daftar pengguna.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      // Update local state agar tidak perlu refresh
      const updatedUsers = users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      );
      setUsers(updatedUsers);

      toast({
        title: "Role Diperbarui",
        description: `User berhasil diubah menjadi ${newRole}`,
      });
    } catch (error) {
      toast({
        title: "Gagal Update",
        description: "Terjadi kesalahan saat mengubah role.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.filter(user => user.id !== userId));
      toast({
        title: "User Dihapus",
        description: "Pengguna berhasil dihapus dari database.",
      });
    } catch (error) {
      toast({
        title: "Gagal Menghapus",
        description: "Gagal menghapus pengguna.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin': 
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200">Superadmin</Badge>;
      case 'admin': 
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">Admin</Badge>;
      default: 
        return <Badge variant="outline" className="text-gray-600">User</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center bg-slate-50 p-4 rounded-lg border">
        <div className="space-y-1">
          <h3 className="font-medium text-slate-900">Daftar Pengguna</h3>
          <p className="text-xs text-slate-500">Total {filteredUsers.length} pengguna terdaftar</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cari username atau email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border shadow-sm bg-white overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[250px]">User Profile</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Loading data...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                  Tidak ada pengguna yang ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{user.username || "No Username"}</span>
                      <div className="flex items-center text-xs text-slate-500 mt-0.5">
                        <Mail className="w-3 h-3 mr-1" />
                        {user.email || "-"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(user.role)}
                  </TableCell>
                  <TableCell>
                    {user.email_confirmed_at ? (
                      <div className="flex items-center text-green-600 text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                      </div>
                    ) : (
                      <div className="flex items-center text-yellow-600 text-xs font-medium">
                        <XCircle className="w-3 h-3 mr-1" /> Pending
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-slate-500 text-sm">
                      <Calendar className="w-3 h-3 mr-2" />
                      {formatDate(user.created_at)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        
                        {/* Opsi Ubah Role */}
                        <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'user')}>
                          <UserCog className="mr-2 h-4 w-4" /> Set as User
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'admin')}>
                          <ShieldAlert className="mr-2 h-4 w-4" /> Set as Admin
                        </DropdownMenuItem>
                        
                        {/* Hanya Superadmin bisa set Superadmin */}
                        {currentUserRole === 'superadmin' && (
                          <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'superadmin')}>
                            <ShieldAlert className="mr-2 h-4 w-4 text-purple-600" /> Set as Superadmin
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuSeparator />
                        
                        {/* Tombol Delete dengan Dialog */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-red-100 hover:text-red-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-red-600 w-full">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </div>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Apakah anda yakin?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tindakan ini akan menghapus data profil <strong>{user.username}</strong> secara permanen.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction 
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                Ya, Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminUserTable;