import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import toast from "react-hot-toast";
import { adminAPI } from "../api/auth";
import { ArrowLeft, Users, Eye, EyeOff, Shield, AlertCircle, Trash2, ToggleLeft, ToggleRight, KeyRound, Pencil } from "lucide-react";
import ConfirmModal from "../components/ConfirmModal";

export default function AdminUsersList() {
  const { user: currentUser, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [modal, setModal] = useState({ open: false, type: "", user: null });
  const [passwordModal, setPasswordModal] = useState({ open: false, user: null, password: "" });
  const [editModal, setEditModal] = useState({ open: false, user: null });

  const fetchUsers = () => {
    adminAPI.getAllUsers()
      .then((res) => { const d = res.data.data; setUsers(Array.isArray(d) ? d : d?.content || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleRole = async (u) => {
    setModal({ open: true, type: "role", user: u });
  };

  const handleDelete = async (u) => {
    setModal({ open: true, type: "delete", user: u });
  };

  const handleEdit = async (u) => {
    setEditModal({ open: true, user: u });
  };

  const confirmAction = async () => {
    const u = modal.user;
    if (modal.type === "role") {
      const newRole = u.role === "ADMIN" ? "USER" : "ADMIN";
      try {
        await adminAPI.updateRole(u.id, newRole);
        toast.success(`${u.name} is now ${newRole}`);
        fetchUsers();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to update role");
      }
    } else if (modal.type === "delete") {
      try {
        await adminAPI.deleteUser(u.id);
        toast.success(`User "${u.name}" deleted`);
        fetchUsers();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to delete user");
      }
    } else if (modal.type === "edit") {
      try {
        await adminAPI.updateUser(modal.user.id, {
          name: modal.user.name,
          email: modal.user.email,
          username: modal.user.username,
        });
        toast.success(`${modal.user.name}'s details updated`);
        fetchUsers();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to update user");
      }
    }
    setModal({ open: false, type: "", user: null });
  };

  const handlePasswordChange = async () => {
    const u = passwordModal.user;
    const pw = passwordModal.password;
    if (!pw || pw.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    try {
      await adminAPI.updatePassword(u.id, { password: pw });
      toast.success(`Password updated for ${u.name}`);
      setPasswordModal({ open: false, user: null, password: "" });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update password");
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">Access Denied</h2>
          <p className="text-sm text-slate-500 mt-1">Only administrators can access this page.</p>
          <button onClick={() => navigate("/dashboard")} className="mt-4 text-sm text-slate-700 underline">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="User Management" />
        <p className="text-xs text-slate-500 -mt-4 mb-6">{users.length} total user{users.length !== 1 ? "s" : ""} on the platform</p>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <LoadingDots className="text-slate-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">No users found</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">#</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Name</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Username</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Email</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Role</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Password</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-6 text-xs text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-6 text-sm text-slate-800 font-medium">{u.name}</td>
                      <td className="py-3 px-6 text-sm text-slate-500 font-mono">{u.username || '-'}</td>
                      <td className="py-3 px-6 text-sm text-slate-600">{u.email}</td>
                      <td className="py-3 px-6">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${u.role === "ADMIN" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-slate-600">
                            {visiblePasswords[u.id] ? (u.rawPassword || u.password) : "••••••••••••••••"}
                          </span>
                          <button onClick={() => setVisiblePasswords((prev) => ({ ...prev, [u.id]: !prev[u.id] }))}
                            className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                            {visiblePasswords[u.id] ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-400" />}
                          </button>
                          <button onClick={() => handleEdit(u)}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
                            title="Edit user details">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-2">
                          {u.email !== currentUser?.email && (
                            <>
                              <button onClick={() => handleToggleRole(u)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
                                title={u.role === "ADMIN" ? "Revoke admin access" : "Grant admin access"}>
                                {u.role === "ADMIN" ? <ToggleRight className="w-3.5 h-3.5 text-amber-500" /> : <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />}
                                {u.role === "ADMIN" ? "Revoke" : "Promote"}
                              </button>
                              <button onClick={() => setPasswordModal({ open: true, user: u, password: "" })}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
                                title="Change password">
                                <KeyRound className="w-3.5 h-3.5" /> Password
                              </button>
                              <button onClick={() => handleDelete(u)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition-colors text-red-500"
                                title="Delete user">
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </>
                          )}
                          {u.email === currentUser?.email && (
                            <span className="text-xs text-slate-400 italic">You</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
              {users.map((u, idx) => (
                <div key={u.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-800">{u.name}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${u.role === "ADMIN" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                      {u.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5 mb-3">
                    <div className="flex items-center gap-1 min-h-[44px]">
                      <span className="font-medium text-slate-600 w-16">Email:</span>
                      <span className="font-mono">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-slate-600 w-16">User:</span>
                      <span className="font-mono">{u.username || '-'}</span>
                    </div>
                  </div>
                  {u.email !== currentUser?.email && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleRole(u)}
                        className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 min-h-[44px]">
                        {u.role === "ADMIN" ? <ToggleRight className="w-3.5 h-3.5 text-amber-500" /> : <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />}
                        {visiblePasswords[u.id] ? (u.rawPassword || u.password) : "••••••••••••••••"}
                      </button>
                      <button onClick={() => setVisiblePasswords((prev) => ({ ...prev, [u.id]: !prev[u.id] }))}
                        className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                        {visiblePasswords[u.id] ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                  )}
                  {u.email === currentUser?.email && (
                    <span className="text-xs text-slate-400 italic">You</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={modal.open}
        title={modal.type === "delete" ? "Delete User" : "Change Role"}
        message={
          modal.type === "delete"
            ? `Delete "${modal.user?.name}" (${modal.user?.email})? This will also delete all their invoices, customers, and products.`
            : `Change ${modal.user?.name}'s role from ${modal.user?.role} to ${modal.user?.role === "ADMIN" ? "USER" : "ADMIN"}?`
        }
        confirmLabel={modal.type === "delete" ? "Delete" : "Confirm"}
        confirmVariant={modal.type === "delete" ? "danger" : "primary"}
        onConfirm={confirmAction}
        onCancel={() => setModal({ open: false, type: "", user: null })}
      />

      {passwordModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setPasswordModal({ open: false, user: null, password: "" })}></div>
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Change Password</h3>
            <p className="text-sm text-slate-500 mb-4">Set a new password for <strong>{passwordModal.user?.name}</strong></p>
            <input
              type="text"
              value={passwordModal.password}
              onChange={(e) => setPasswordModal({ ...passwordModal, password: e.target.value })}
              placeholder="Enter new password"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setPasswordModal({ open: false, user: null, password: "" })}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handlePasswordChange}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
                Save Password
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEditModal({ open: false, user: null })}></div>
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Edit User</h3>
            <p className="text-sm text-slate-500 mb-4">Update details for <strong>{editModal.user?.name}</strong></p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Name</label>
                <input
                  value={editModal.user?.name || ""}
                  onChange={(e) => setEditModal({ ...editModal, user: { ...editModal.user, name: e.target.value } })}
                  placeholder="Enter name"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 mb-2"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Email</label>
                <input
                  value={editModal.user?.email || ""}
                  onChange={(e) => setEditModal({ ...editModal, user: { ...editModal.user, email: e.target.value } })}
                  placeholder="Enter email"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 mb-2"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Username</label>
                <input
                  value={editModal.user?.username || ""}
                  onChange={(e) => setEditModal({ ...editModal, user: { ...editModal.user, username: e.target.value } })}
                  placeholder="Enter username"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 mb-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModal({ open: false, user: null })}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={async () => {
                try {
                  await adminAPI.updateUser(editModal.user.id, {
                    name: editModal.user.name,
                    email: editModal.user.email,
                    username: editModal.user.username,
                  });
                  toast.success(`${editModal.user.name}'s details updated`);
                  setEditModal({ open: false, user: null });
                  fetchUsers();
                } catch (err) {
                  toast.error(err.response?.data?.message || "Failed to update user");
                }
              }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        h1 { font-family: 'Space Grotesk', sans-serif; }
      `}</style>
    </div>
  );
}
