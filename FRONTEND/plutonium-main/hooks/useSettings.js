import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { showToast } from '../components/Toast';
import { useAuth } from '../store/authStore';

export function useSettings() {
  const queryClient = useQueryClient();
  const { updateUser } = useAuth();

  const updateUsernameMutation = useMutation({
    mutationFn: (username) => api.updateUsername(username),
    onSuccess: (data) => {
      updateUser({ username: data.username });
      queryClient.invalidateQueries(['user']);
      showToast('Username updated successfully', 'success');
    },
    onError: (error) => {
      showToast(error.message || 'Failed to update username', 'error');
    }
  });

  const updatePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }) => 
      api.updatePassword(currentPassword, newPassword),
    onSuccess: () => {
      showToast('Password updated successfully', 'success');
    },
    onError: (error) => {
      showToast(error.message || 'Failed to update password', 'error');
    }
  });

  const updateProfilePictureMutation = useMutation({
    mutationFn: (file) => api.updateProfilePicture(file),
    onSuccess: (data) => {
      updateUser({ profilePicture: data.profilePictureUrl });
      queryClient.invalidateQueries(['user']);
      showToast('Profile picture updated successfully', 'success');
    },
    onError: (error) => {
      showToast(error.message || 'Failed to update profile picture', 'error');
    }
  });

  return {
    updateUsername: (username) => updateUsernameMutation.mutateAsync(username),
    updatePassword: (currentPassword, newPassword) => 
      updatePasswordMutation.mutateAsync({ currentPassword, newPassword }),
    updateProfilePicture: (file) => updateProfilePictureMutation.mutateAsync(file),
    isLoading: updateUsernameMutation.isPending || 
               updatePasswordMutation.isPending || 
               updateProfilePictureMutation.isPending
  };
}
