import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { getUserProfile, uploadProfilePicture, updateUserProfileData } from '../../services/userProfileService';

const ProfilePage = ({ onBack, onSave, user }) => {
  // State management for form fields
  const [name, setName] = useState('');
  const [zodiac, setZodiac] = useState('');
  const [status, setStatus] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  // Load existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.email) return;

      try {
        const profile = await getUserProfile(user.email);

        if (profile) {
          setName(profile.displayName || user.displayName || '');
          setZodiac(profile.zodiac || '');
          setStatus(profile.status || '');
          setPhotoURL(profile.photoURL || user.photoURL || '');
        } else {
          setName(user.displayName || '');
          setPhotoURL(user.photoURL || '');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setName(user.displayName || '');
        setPhotoURL(user.photoURL || '');
      }
    };

    loadProfile();
  }, [user]);

  // Handle back button click
  const handleBackClick = () => {
    if (onBack) {
      onBack();
    }
  };

  // Handle profile photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.email) return;

    try {
      setUploadingPhoto(true);

      // Upload to Firebase Storage
      const downloadURL = await uploadProfilePicture(file, user.email);

      // Update photo URL in state
      setPhotoURL(downloadURL);

      // Save to Firestore immediately
      await updateUserProfileData(user.email, { photoURL: downloadURL });

      console.log('✅ Profile picture updated');
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Handle done button click - save all profile data
  const handleDoneClick = async () => {
    if (!user?.email) return;

    try {
      setLoading(true);

      // Save profile data to Firestore
      await updateUserProfileData(user.email, {
        displayName: name,
        zodiac,
        status,
        photoURL,
      });

      console.log('✅ Profile saved successfully');

      if (onSave) {
        onSave({ name, zodiac, status, photoURL });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col font-display group/design-root overflow-x-hidden bg-background-dark">
      {/* Radial gradient background */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-[radial-gradient(ellipse_40%_50%_at_50%_0%,_rgba(164,19,236,0.3),_rgba(0,0,0,0))] pointer-events-none -z-1 opacity-70"></div>

      <main className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center bg-transparent p-4 justify-between sticky top-0 z-10">
          <div className="flex size-12 shrink-0 items-center justify-start">
            <button
              className="flex items-center justify-center text-white"
              onClick={handleBackClick}
            >
              <span className="material-symbols-outlined text-3xl">arrow_back_ios_new</span>
            </button>
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-white text-lg font-bold">My Profile</h1>
          </div>
          <div className="flex w-12 items-center justify-end">
            <button
              className="text-primary text-lg font-bold disabled:opacity-50"
              onClick={handleDoneClick}
              disabled={loading || uploadingPhoto}
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                'Done'
              )}
            </button>
          </div>
        </div>

        {/* Profile Content */}
        <div className="flex-1 flex flex-col items-center px-4 pt-8 pb-4">
          {/* Hidden file input for profile picture */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />

          {/* Profile Picture with Edit Badge */}
          <div className="relative">
            {uploadingPhoto ? (
              <div className="aspect-square rounded-full size-32 bg-gray-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-[#A076F9] animate-spin">
                  progress_activity
                </span>
              </div>
            ) : (
              <img
                src={photoURL || 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=300'}
                alt="Profile"
                referrerPolicy="no-referrer"
                className="aspect-square rounded-full size-32 object-cover bg-gray-600"
                onError={(e) => {
                  e.target.src = 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=300';
                }}
              />
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 flex items-center justify-center size-8 bg-primary rounded-full border-2 border-background-dark disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-white text-lg">edit</span>
            </button>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="text-primary text-base font-semibold mt-4 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {uploadingPhoto ? 'Uploading...' : 'Edit Photo'}
          </button>

          {/* Form Fields */}
          <div className="w-full flex flex-col gap-4 mt-8">
            {/* Name Field */}
            <label className="flex flex-col min-w-40 h-14 w-full">
              <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                <input
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-0 border-none bg-surface-dark focus:border-none h-full placeholder:text-text-secondary-dark px-4 text-base font-normal leading-normal"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </label>

            {/* Zodiac Sign Field */}
            <label className="flex flex-col min-w-40 h-14 w-full">
              <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                <input
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-0 border-none bg-surface-dark focus:border-none h-full placeholder:text-text-secondary-dark px-4 text-base font-normal leading-normal"
                  placeholder="Zodiac Sign"
                  value={zodiac}
                  onChange={(e) => setZodiac(e.target.value)}
                />
              </div>
            </label>

            {/* Status Field */}
            <label className="flex flex-col min-w-40 h-14 w-full">
              <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                <input
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-0 border-none bg-surface-dark focus:border-none h-full placeholder:text-text-secondary-dark px-4 text-base font-normal leading-normal"
                  placeholder="Status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                />
              </div>
            </label>
          </div>
        </div>
      </main>
    </div>
  );
};

ProfilePage.propTypes = {
  onBack: PropTypes.func,
  onSave: PropTypes.func,
  user: PropTypes.object,
};

export default ProfilePage;
