
import { UserProfile, Wallet, WalletMember } from '../types';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const BACKUPS_TABLE = 'backups';
const PROFILES_TABLE = 'users_public'; 
const WALLETS_TABLE = 'wallets';
const MEMBERS_TABLE = 'wallet_members';
const WALLET_DATA_TABLE = 'wallet_data';
const AVATAR_BUCKET = 'public-photos'; 
const BACKUP_TIMEOUT_MS = 30000; // 30s Timeout
const MAX_PAYLOAD_SIZE_BYTES = 6 * 1024 * 1024; // 6MB Limit

const isSoftError = (err: any) => {
    if (!err) return false;
    return err.code === '42P01' || // Undefined table
           err.code === '42703' || // Undefined column
           err.code === '42501' || // RLS violation
           (err.message && (
             err.message.includes('Could not find') || 
             err.message.includes('row-level security') ||
             err.message.includes('violates row-level security')
           ));
};

const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                const MAX_DIM = 1024;
                if (width > MAX_DIM || height > MAX_DIM) {
                    const scale = MAX_DIM / Math.max(width, height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error("Browser canvas not supported")); return; }
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (!blob) { reject(new Error("Image compression failed")); return; }
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };
            img.onerror = () => reject(new Error("Failed to load image for processing"));
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
    });
};

export const cloudDrive = {
  formatSize: (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  login: async (email: string, pass: string): Promise<UserProfile> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("Login failed");
      
      return await cloudDrive.ensureUserProfile(data.user);
  },

  signup: async (email: string, pass: string, name: string): Promise<void> => {
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { full_name: name } }
      });
      if (error) throw new Error(error.message);
  },

  resetPassword: async (email: string): Promise<void> => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw new Error(error.message);
  },

  ensureUserProfile: async (user: User): Promise<UserProfile> => {
      const meta = user.user_metadata || {};
      
      const profile: UserProfile = {
          id: user.id,
          name: meta.full_name || meta.name || 'User',
          email: user.email || null,
          address: meta.address || '',
          photoURL: meta.photo_url || meta.avatar_url || undefined,
          createdAt: user.created_at,
          emailVerified: !!user.email_confirmed_at
      };

      try {
        await supabase
          .from(PROFILES_TABLE)
          .upsert({
            id: user.id,
            email: user.email,
            full_name: profile.name,
            photo_url: profile.photoURL,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
      } catch (e) {
        console.warn("Public profile sync skipped:", e);
      }

      return profile;
  },

  updateUserProfile: async (userId: string, data: { name?: string; address?: string; photoURL?: string | null }): Promise<void> => {
      const dbUpdates: any = {};
      const authUpdates: any = {};

      if (data.name !== undefined) {
          dbUpdates.full_name = data.name;
          authUpdates.full_name = data.name;
      }
      if (data.address !== undefined) {
          dbUpdates.address = data.address;
          authUpdates.address = data.address;
      }
      if (data.photoURL !== undefined) {
          dbUpdates.photo_url = data.photoURL;
          authUpdates.photo_url = data.photoURL;
      }

      const { error: dbError } = await supabase.from(PROFILES_TABLE).update(dbUpdates).eq('id', userId);
      const { error: authError } = await supabase.auth.updateUser({ data: authUpdates });
      
      if (dbError && !isSoftError(dbError)) {
          console.error("Database profile update failed:", dbError);
      }
      if (authError) {
          throw new Error(`Auth update failed: ${authError.message}`);
      }
  },

  uploadProfilePicture: async (userId: string, file: File, onProgress?: (progress: number) => void): Promise<string> => {
      if (!navigator.onLine) throw new Error("No internet connection.");
      let blobToUpload: Blob;
      try { blobToUpload = await compressImage(file); } catch (e) { blobToUpload = file; }
      
      const fileName = `${userId}/avatar.jpg`;
      
      if(onProgress) onProgress(10);
      const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(fileName, blobToUpload, { 
        contentType: 'image/jpeg', 
        cacheControl: '3600', 
        upsert: true 
      });
      if (error) throw new Error(error.message);
      
      if(onProgress) onProgress(100);
      
      const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(fileName);
      const publicURL = `${urlData.publicUrl}?t=${Date.now()}`;
      
      await cloudDrive.updateUserProfile(userId, { photoURL: publicURL });
      return publicURL;
  },

  uploadReceipt: async (userId: string, file: File): Promise<string> => {
    if (!navigator.onLine) throw new Error("No internet connection.");
    let blobToUpload: Blob;
    try { blobToUpload = await compressImage(file); } catch (e) { blobToUpload = file; }
    
    const fileName = `receipts/${userId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(fileName, blobToUpload, { 
      contentType: 'image/jpeg', 
      upsert: true 
    });
    
    if (error) throw new Error(error.message);
    
    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(fileName);
    return urlData.publicUrl;
  },

  deleteProfilePicture: async (userId: string): Promise<void> => {
      if (!navigator.onLine) throw new Error("No internet connection.");
      await cloudDrive.updateUserProfile(userId, { photoURL: null });
  },

  backupUserData: async (userId: string, appData: any): Promise<{ timestamp: string; skipped: boolean }> => {
    if (!navigator.onLine) throw new Error("Device is offline.");
    const timestamp = new Date().toISOString();
    
    let payloadStr = '';
    try {
        payloadStr = JSON.stringify(appData);
        const sizeBytes = new Blob([payloadStr]).size; 
        
        if (sizeBytes > MAX_PAYLOAD_SIZE_BYTES) {
            throw new Error(`Data is too large (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB). Max limit is 6MB.`);
        }
    } catch (e: any) {
        throw new Error(e.message || "Failed to process data for backup.");
    }

    const metadata = { 
        "source": "smart-budget-tracker", 
        "version": "1.0",
        "timestamp": timestamp,
        "items_count": appData.transactions?.length || 0
    };

    const backupPromise = supabase
            .from(BACKUPS_TABLE)
            .upsert({
                user_id: userId,
                data: appData,
                metadata: metadata,
                updated_at: timestamp
            }, { onConflict: 'user_id' }) 
            .select();

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Backup request timed out.")), BACKUP_TIMEOUT_MS)
    );

    try {
        const result: any = await Promise.race([backupPromise, timeoutPromise]);
        const { error } = result;

        if (error) throw new Error(error.message || "Cloud backup failed.");
        
        return { timestamp, skipped: false };
    } catch (e: any) {
        throw new Error(e.message || "Backup failed.");
    }
  },

  restoreBackup: async (userId: string): Promise<any | null> => {
      if (!navigator.onLine) return null;
      try {
          const { data, error } = await supabase
            .from(BACKUPS_TABLE)
            .select('data, metadata, updated_at')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (error) return null;
          if (!data || !data.data) return null;
          
          return { 
              data: data.data, 
              metadata: { 
                  ...data.metadata, 
                  timestamp: data.updated_at 
              } 
          };
      } catch (e) {
          return null;
      }
  },

  // --- SHARED WALLET METHODS ---

  createWallet: async (userId: string, name: string, currency: string): Promise<Wallet> => {
    if (!navigator.onLine) throw new Error("Offline");
    
    // 1. Create Wallet (Trigger RLS insert check for wallets)
    const { data: walletData, error: walletError } = await supabase
        .from(WALLETS_TABLE)
        .insert({ name, currency, created_by: userId })
        .select()
        .single();
    
    if (walletError) {
        // If error is recursion, provide hint
        if (walletError.message.includes('recursion') || walletError.code === '42P17') {
            throw new Error("Database Error: Infinite Recursion. Please run 'supabase_setup.sql' in SQL Editor.");
        }
        throw new Error(walletError.message);
    }
    
    // 2. Add creator as Owner (Trigger RLS insert check for members)
    const { error: memberError } = await supabase
        .from(MEMBERS_TABLE)
        .insert({ wallet_id: walletData.id, user_id: userId, role: 'owner' });

    if (memberError) {
        // ROLLBACK: Delete the wallet if member insertion fails to prevent ghost wallets
        await supabase.from(WALLETS_TABLE).delete().eq('id', walletData.id);
        
        if (memberError.message.includes('recursion') || memberError.code === '42P17') {
            throw new Error("Database Error: Infinite Recursion. Please run 'supabase_setup.sql' in SQL Editor.");
        }
        throw new Error("Failed to assign owner: " + memberError.message);
    }

    return { ...walletData, role: 'owner', is_shared: true };
  },

  getMyWallets: async (userId: string): Promise<Wallet[]> => {
    if (!navigator.onLine) return [];
    
    // 1. Get memberships to find wallet IDs and Roles
    const { data: members, error: memError } = await supabase
        .from(MEMBERS_TABLE)
        .select('wallet_id, role')
        .eq('user_id', userId);
        
    if (memError || !members.length) return [];

    const walletIds = members.map(m => m.wallet_id);
    const roleMap = new Map(members.map(m => [m.wallet_id, m.role]));

    // 2. Get Wallet Details
    const { data: wallets, error: wError } = await supabase
        .from(WALLETS_TABLE)
        .select('*')
        .in('id', walletIds);

    if (wError) return [];

    return wallets.map(w => ({
        ...w,
        role: roleMap.get(w.id) || 'viewer',
        is_shared: true
    }));
  },

  getWalletData: async (walletId: string): Promise<any | null> => {
    if (!navigator.onLine) return null;
    const { data, error } = await supabase
        .from(WALLET_DATA_TABLE)
        .select('data')
        .eq('wallet_id', walletId)
        .maybeSingle();

    if (error) { console.error("Wallet Fetch Error", error); return null; }
    return data?.data || null;
  },

  syncWalletData: async (walletId: string, userId: string, appData: any): Promise<void> => {
    if (!navigator.onLine) throw new Error("Offline");
    
    const { error } = await supabase
        .from(WALLET_DATA_TABLE)
        .upsert({ 
            wallet_id: walletId,
            data: appData,
            updated_by: userId,
            updated_at: new Date().toISOString()
        }, { onConflict: 'wallet_id' });

    if (error) throw new Error(error.message);
  },

  searchUserByEmail: async (email: string): Promise<UserProfile | null> => {
     if (!navigator.onLine) return null;
     const { data, error } = await supabase
        .from(PROFILES_TABLE)
        .select('*')
        .ilike('email', email.trim()) 
        .maybeSingle();
        
     if (error || !data) return null;
     
     return {
         id: data.id,
         name: data.full_name || 'User',
         email: data.email,
         photoURL: data.photo_url,
         createdAt: data.updated_at,
         emailVerified: true
     };
  },

  addWalletMember: async (walletId: string, userId: string, role: string): Promise<void> => {
      const { error } = await supabase
        .from(MEMBERS_TABLE)
        .insert({ wallet_id: walletId, user_id: userId, role });
      
      if (error) {
          if (error.code === '23505') throw new Error("User is already a member.");
          throw new Error(error.message);
      }
  },

  getWalletMembers: async (walletId: string): Promise<WalletMember[]> => {
      const { data, error } = await supabase
        .from(MEMBERS_TABLE)
        .select('user_id, role, wallet_id')
        .eq('wallet_id', walletId);
      
      if (error) throw new Error(error.message);

      // Enrich with profile info
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase.from(PROFILES_TABLE).select('id, full_name, email, photo_url').in('id', userIds);
      
      return data.map(m => {
          const p = profiles?.find(prof => prof.id === m.user_id);
          return {
              ...m,
              full_name: p?.full_name || 'Unknown',
              email: p?.email || '',
              photo_url: p?.photo_url
          };
      });
  },

  removeWalletMember: async (walletId: string, userId: string): Promise<void> => {
     const { error } = await supabase
        .from(MEMBERS_TABLE)
        .delete()
        .match({ wallet_id: walletId, user_id: userId });
     if (error) throw new Error(error.message);
  },

  deleteWallet: async (walletId: string): Promise<void> => {
      if (!navigator.onLine) throw new Error("Offline");
      
      // Cascading delete relies on database rules OR manual cleanup
      // Supabase rows should cascade if foreign keys are set up correctly.
      // If not, we attempt to delete in order.
      
      try {
          // 1. Delete Members
          await supabase.from(MEMBERS_TABLE).delete().eq('wallet_id', walletId);
          
          // 2. Delete Data
          await supabase.from(WALLET_DATA_TABLE).delete().eq('wallet_id', walletId);
          
          // 3. Delete Wallet
          const { error } = await supabase.from(WALLETS_TABLE).delete().eq('id', walletId);
          
          if (error) throw new Error(error.message);
      } catch (e: any) {
          throw new Error("Failed to delete wallet: " + e.message);
      }
  }
};
