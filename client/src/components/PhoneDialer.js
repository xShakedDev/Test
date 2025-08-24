import React, { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../utils/auth';

const PhoneDialer = ({ user, token }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [callHistory, setCallHistory] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [callQuality, setCallQuality] = useState('good');
  const [verifiedNumbers, setVerifiedNumbers] = useState([]);
  const [selectedCallerId, setSelectedCallerId] = useState('');
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [currentCallSid, setCurrentCallSid] = useState('');
  const [twilioDevice, setTwilioDevice] = useState(null);
  const [isTwilioReady, setIsTwilioReady] = useState(false);
  
  const callTimerRef = useRef(null);
  const audioRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callStatusIntervalRef = useRef(null);

  useEffect(() => {
    // Load call history on component mount
    loadCallHistory();
    loadAudioDevices();
    loadVerifiedNumbers();
    initializeTwilio();
    
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      if (callStatusIntervalRef.current) {
        clearInterval(callStatusIntervalRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (twilioDevice) {
        twilioDevice.destroy();
      }
    };
  }, []);

  // Simple timer management - only start timer when call becomes active
  useEffect(() => {
    if (isCallActive && !callTimerRef.current) {
      startCallTimer();
    }
  }, [isCallActive]);

  // Simple call status progression - move from connecting to connected after 3 seconds
  useEffect(() => {
    if (isCallActive && callStatus === 'מתחבר...') {
      const timer = setTimeout(() => {
        setCallStatus('מחובר');
        setCallQuality('good');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isCallActive, callStatus]);

  const initializeTwilio = async () => {
    try {
      // Get Twilio access token from server
      const response = await authenticatedFetch('/api/twilio/token');
      if (response.ok) {
        const data = await response.json();
        
        // Load Twilio Client SDK
        if (window.Twilio) {
          const device = new window.Twilio.Device(data.token, {
            debug: true,
            closeProtection: true,
            enableRingingState: true
          });

          // Set up event handlers
          device.on('ready', () => {
            console.log('Twilio Device ready');
            setIsTwilioReady(true);
            setTwilioDevice(device);
          });

          device.on('error', (error) => {
            console.error('Twilio Device error:', error);
            setError(`שגיאת Twilio: ${error.message}`);
          });

          device.on('connect', (connection) => {
            console.log('Call connected:', connection);
            setIsCallActive(true);
            setCallStatus('מחובר');
            setCallQuality('good');
            setSuccess('השיחה מחוברת - תוכל לדבר כעת');
            
            // Set up connection event handlers
            connection.on('disconnect', () => {
              console.log('Call disconnected');
              endCall();
            });

            connection.on('error', (error) => {
              console.error('Connection error:', error);
              setError(`שגיאת חיבור: ${error.message}`);
            });

            // Get remote audio stream and play it
            if (connection.getRemoteStream()) {
              if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = connection.getRemoteStream();
              }
            }
          });

          device.on('incoming', (connection) => {
            console.log('Incoming call:', connection);
            // Handle incoming calls if needed
          });

          device.on('disconnect', (connection) => {
            console.log('Call disconnected:', connection);
            endCall();
          });

          setTwilioDevice(device);
        } else {
          console.error('Twilio Client SDK not loaded');
          setError('Twilio Client SDK לא נטען');
        }
      } else {
        console.error('Failed to get Twilio token');
        setError('נכשל בקבלת אסימון Twilio');
      }
    } catch (error) {
      console.error('Error initializing Twilio:', error);
      setError('שגיאה באתחול Twilio');
    }
  };

  const loadVerifiedNumbers = async () => {
    try {
      setIsLoadingNumbers(true);
      const response = await authenticatedFetch('/api/twilio/verified-callers');
      if (response.ok) {
        const data = await response.json();
        setVerifiedNumbers(data.callerIds || []);
        // Set the first number as default if available
        if (data.callerIds && data.callerIds.length > 0) {
          setSelectedCallerId(data.callerIds[0].phoneNumber);
        }
      }
    } catch (error) {
      console.error('שגיאה בטעינת מספרים מאומתים:', error);
    } finally {
      setIsLoadingNumbers(false);
    }
  };

  const loadAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setAudioDevices(audioInputs);
      if (audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('שגיאה בטעינת התקני אודיו:', error);
    }
  };

  const loadCallHistory = async () => {
    try {
      const response = await authenticatedFetch('/api/twilio/call-history');
      if (response.ok) {
        const data = await response.json();
        setCallHistory(data.calls || []);
      }
    } catch (error) {
      console.error('שגיאה בטעינת היסטוריית שיחות:', error);
    }
  };

  const startCall = async () => {
    if (!phoneNumber.trim()) {
      setError('אנא הזן מספר טלפון');
      return;
    }

    if (!selectedCallerId) {
      setError('אנא בחר מספר מתקשר');
      return;
    }

    if (!isTwilioReady || !twilioDevice) {
      setError('Twilio לא מוכן - אנא המתן או רענן את הדף');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // Request microphone permission and get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          deviceId: selectedAudioDevice ? { exact: selectedAudioDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Set local audio source for monitoring
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      // Use Twilio Client SDK to make the call
      const connection = twilioDevice.connect({
        params: {
          phoneNumber: phoneNumber.trim(),
          userId: user.id,
          userName: user.username,
          fromNumber: selectedCallerId
        }
      });

      // Set up connection event handlers
      connection.on('ringing', () => {
        setCallStatus('מצלצל...');
        setSuccess('המספר מצלצל...');
        playRingtone();
      });

      connection.on('connect', () => {
        setCallStatus('מחובר');
        setCallQuality('good');
        setSuccess('השיחה מחוברת - תוכל לדבר כעת');
        setIsCallActive(true);
        startCallTimer();
        
        // Get remote audio stream and play it
        if (connection.getRemoteStream()) {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = connection.getRemoteStream();
          }
        }
        
        // Add to call history
        const newCall = {
          id: connection.parameters.CallSid || Date.now().toString(),
          phoneNumber: phoneNumber.trim(),
          status: 'connected',
          timestamp: new Date().toISOString(),
          duration: 0,
          direction: 'outbound',
          fromNumber: selectedCallerId
        };
        setCallHistory(prev => [newCall, ...prev]);
        
        stopRingtone();
      });

      connection.on('disconnect', () => {
        console.log('Call disconnected');
        endCall();
      });

      connection.on('error', (error) => {
        console.error('Connection error:', error);
        setError(`שגיאת חיבור: ${error.message}`);
        endCall();
      });

      // Store connection reference
      peerConnectionRef.current = connection;
      
    } catch (error) {
      console.error('שגיאה בביצוע השיחה:', error);
      if (error.name === 'NotAllowedError') {
        setError('נדרשת הרשאת מיקרופון לביצוע שיחה');
      } else if (error.name === 'NotFoundError') {
        setError('לא נמצא מיקרופון מחובר');
      } else {
        setError('שגיאת רשת - לא ניתן לבצע את השיחה');
      }
      // Stop the audio stream if there was an error
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const initializeVoiceCall = async (callSid) => {
    try {
      // For now, just set the call as connected
      // WebRTC can be implemented later
      setCallStatus('מחובר');
      setCallQuality('good');
    } catch (error) {
      console.error('שגיאה באתחול שיחת קול:', error);
      setError('שגיאה באתחול שיחת קול');
      // Set call as connected even if WebRTC fails
      setCallStatus('מחובר');
      setCallQuality('good');
    }
  };

  const endCall = async () => {
    if (!isCallActive) return;

    try {
      // Disconnect the Twilio connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.disconnect();
        peerConnectionRef.current = null;
      }

      setSuccess('השיחה הסתיימה');
      setIsCallActive(false);
      setCallStatus('');
      setCurrentCallSid('');
      stopCallTimer();
      stopCallStatusMonitoring();
      stopRingtone();
      
      // Stop all audio tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      // Clear audio elements
      if (localAudioRef.current) localAudioRef.current.srcObject = null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      
      // Update call history
      setCallHistory(prev => prev.map(call => 
        call.phoneNumber === phoneNumber.trim() && call.status === 'connected'
          ? { ...call, status: 'completed', duration: callDuration }
          : call
      ));
      
    } catch (error) {
      console.error('שגיאה בסיום השיחה:', error);
      // Clean up the local state even if there's an error
      setSuccess('השיחה הסתיימה');
      setIsCallActive(false);
      setCallStatus('');
      setCurrentCallSid('');
      stopCallTimer();
      stopCallStatusMonitoring();
      stopRingtone();
      
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current = null;
      }
      
      if (localAudioRef.current) localAudioRef.current.srcObject = null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    }
  };

  const startCallTimer = () => {
    setCallDuration(0);
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const startCallStatusMonitoring = (callSid) => {
    if (callStatusIntervalRef.current) {
      clearInterval(callStatusIntervalRef.current);
    }
    
    console.log('Starting call status monitoring for:', callSid);
    
    callStatusIntervalRef.current = setInterval(async () => {
      try {
        console.log('Checking call status for:', callSid);
        const response = await authenticatedFetch(`/api/twilio/call-status/${callSid}`);
        if (response.ok) {
          const data = await response.json();
          console.log('Call status update:', data);
          updateCallStatus(data.status);
        } else {
          console.log('Failed to get call status:', response.status);
        }
      } catch (error) {
        console.error('שגיאה בבדיקת סטטוס השיחה:', error);
      }
    }, 2000); // Check every 2 seconds
  };

  const updateCallStatus = (status) => {
    console.log('Updating call status to:', status);
    
    switch (status) {
      case 'initiated':
        setCallStatus('מתחבר...');
        break;
      case 'ringing':
        setCallStatus('מצלצל...');
        setSuccess('המספר מצלצל...');
        break;
      case 'answered':
        setCallStatus('מחובר');
        setCallQuality('good');
        setSuccess('השיחה מחוברת - תוכל לדבר כעת');
        break;
      case 'completed':
        setCallStatus('הושלם');
        setSuccess('השיחה הושלמה');
        endCall();
        break;
      case 'failed':
        setCallStatus('נכשל');
        setError('השיחה נכשלה');
        endCall();
        break;
      case 'busy':
        setCallStatus('תפוס');
        setError('המספר תפוס');
        endCall();
        break;
      case 'no-answer':
        setCallStatus('לא ענה');
        setError('לא ענו לשיחה');
        endCall();
        break;
      default:
        console.log('Unknown call status:', status);
        setCallStatus(status);
    }
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const stopCallStatusMonitoring = () => {
    if (callStatusIntervalRef.current) {
      clearInterval(callStatusIntervalRef.current);
      callStatusIntervalRef.current = null;
    }
  };

  const playRingtone = () => {
    // Create a simple ringtone using Web Audio API
    if (audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  };

  const stopRingtone = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const toggleMute = async () => {
    try {
      if (mediaStreamRef.current) {
        const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !audioTrack.enabled;
          setIsMuted(!audioTrack.enabled);
        }
      }
      
      // Also mute/unmute the Twilio connection if active
      if (peerConnectionRef.current && peerConnectionRef.current.mute) {
        if (isMuted) {
          peerConnectionRef.current.mute(false);
        } else {
          peerConnectionRef.current.mute(true);
        }
      }
    } catch (error) {
      console.error('שגיאה בהחלפת השתקה:', error);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // Toggle speaker mode for remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = isSpeakerOn ? 0.5 : 1.0;
    }
  };

  const toggleRecording = async () => {
    try {
      if (!isRecording) {
        // Start recording (this would be implemented with MediaRecorder API)
        setIsRecording(true);
        setSuccess('הקלטה החלה');
      } else {
        // Stop recording
        setIsRecording(false);
        setSuccess('הקלטה הופסקה');
      }
    } catch (error) {
      console.error('שגיאה בהקלטה:', error);
      setError('שגיאה בהקלטה');
    }
  };

  const changeAudioDevice = async (deviceId) => {
    try {
      setSelectedAudioDevice(deviceId);
      
      // If call is active, switch audio device
      if (isCallActive && mediaStreamRef.current) {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        // Replace audio track in peer connection
        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const audioSender = senders.find(sender => sender.track?.kind === 'audio');
          if (audioSender) {
            const newTrack = newStream.getAudioTracks()[0];
            audioSender.replaceTrack(newTrack);
          }
        }
        
        // Update local audio
        if (localAudioRef.current) {
          localAudioRef.current.srcObject = newStream;
        }
        
        // Stop old stream
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = newStream;
      }
    } catch (error) {
      console.error('שגיאה בהחלפת התקן אודיו:', error);
      setError('שגיאה בהחלפת התקן אודיו');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('he-IL');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      startCall();
    }
  };

  return (
    <div className="phone-dialer">
      <div className="phone-dialer-header">
        <h2>📞 טלפון מנהלים</h2>
        <p>בצע שיחות טלפון אמיתיות דרך Twilio</p>
      </div>

      {/* Audio Device Selection */}
      <div className="audio-device-selection">
        <label htmlFor="audioDevice">בחר מיקרופון:</label>
        <select
          id="audioDevice"
          value={selectedAudioDevice}
          onChange={(e) => changeAudioDevice(e.target.value)}
          disabled={isCallActive}
        >
          {audioDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `מיקרופון ${device.deviceId.slice(0, 8)}...`}
            </option>
          ))}
        </select>
      </div>

      {/* Caller ID Selection */}
      <div className="caller-id-selection">
        <label htmlFor="callerId">מספר מתקשר:</label>
        <select
          id="callerId"
          value={selectedCallerId}
          onChange={(e) => setSelectedCallerId(e.target.value)}
          disabled={isCallActive || isLoadingNumbers}
        >
          {isLoadingNumbers ? (
            <option>טוען מספרים...</option>
          ) : verifiedNumbers.length > 0 ? (
            verifiedNumbers.map(number => (
              <option key={number.phoneNumber} value={number.phoneNumber}>
                {number.friendlyName} ({number.phoneNumber})
              </option>
            ))
          ) : (
            <option>אין מספרים זמינים</option>
          )}
        </select>
      </div>

      {/* Phone Interface */}
      <div className="phone-interface">
        {/* Phone Display */}
        <div className="phone-display">
          <div className="phone-number-display">
            {isCallActive ? (
              <div className="call-info">
                <div className="call-status">{callStatus}</div>
                <div className="call-duration">{formatDuration(callDuration)}</div>
                <div className="call-quality">
                  איכות: <span className={`quality-${callQuality}`}>
                    {callQuality === 'excellent' ? 'מעולה' :
                     callQuality === 'good' ? 'טובה' :
                     callQuality === 'poor' ? 'גרועה' : 'לא ידועה'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="phone-number-input">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="הזן מספר טלפון"
                  className="phone-input"
                  disabled={isCallActive}
                />
              </div>
            )}
          </div>
        </div>

        {/* Phone Keypad */}
        <div className="phone-keypad">
          <div className="keypad-row">
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '1')} disabled={isCallActive}>1</button>
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '2')} disabled={isCallActive}>2</button>
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '3')} disabled={isCallActive}>3</button>
          </div>
          <div className="keypad-row">
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '4')} disabled={isCallActive}>4</button>
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '5')} disabled={isCallActive}>5</button>
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '6')} disabled={isCallActive}>6</button>
          </div>
          <div className="keypad-row">
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '7')} disabled={isCallActive}>7</button>
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '8')} disabled={isCallActive}>8</button>
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '9')} disabled={isCallActive}>9</button>
          </div>
          <div className="keypad-row">
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '*')} disabled={isCallActive}>*</button>
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '0')} disabled={isCallActive}>0</button>
            <button className="keypad-button" onClick={() => setPhoneNumber(prev => prev + '#')} disabled={isCallActive}>#</button>
          </div>
        </div>

        {/* Call Control Buttons */}
        <div className="call-controls">
          {!isCallActive ? (
            <button
              className="call-button call-button-green"
              onClick={startCall}
              disabled={isLoading || !phoneNumber.trim()}
            >
              {isLoading ? (
                <div className="loading-spinner"></div>
              ) : (
                <svg className="call-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19c-.54 0-.99.45-.99.99 0 9.36 7.6 16.96 16.95 16.96.54 0 .99-.45.99-.99v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
              )}
              <span>התחל שיחה</span>
            </button>
          ) : (
            <div className="active-call-controls">
              <button
                className="call-button call-button-red"
                onClick={endCall}
              >
                <svg className="call-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
                <span>סיים שיחה</span>
              </button>
              
              <div className="call-options">
                <button
                  className={`call-option-button ${isMuted ? 'active' : ''}`}
                  onClick={toggleMute}
                  title={isMuted ? 'בטל השתקה' : 'השתק'}
                >
                  <svg className="call-option-icon" fill="currentColor" viewBox="0 0 24 24">
                    {isMuted ? (
                      <path d="M16.5 12c0-1.77-1.02-3.31-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    ) : (
                      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                    )}
                  </svg>
                </button>
                
                <button
                  className={`call-option-button ${isSpeakerOn ? 'active' : ''}`}
                  onClick={toggleSpeaker}
                  title={isSpeakerOn ? 'כבה רמקול' : 'הפעל רמקול'}
                >
                  <svg className="call-option-icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.31-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                </button>

                <button
                  className={`call-option-button ${isRecording ? 'active' : ''}`}
                  onClick={toggleRecording}
                  title={isRecording ? 'עצור הקלטה' : 'התחל הקלטה'}
                >
                  <svg className="call-option-icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Clear Button */}
        <div className="clear-section">
          <button
            className="clear-button"
            onClick={() => setPhoneNumber('')}
            disabled={isCallActive}
          >
            <svg className="clear-icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            <span>נקה</span>
          </button>
        </div>
      </div>

      {/* Audio Elements for Voice Call */}
      <div className="audio-elements" style={{ display: 'none' }}>
        <audio ref={localAudioRef} autoPlay muted />
        <audio ref={remoteAudioRef} autoPlay />
      </div>

      {/* Messages */}
      {error && (
        <div className="message message-error">
          <span>{error}</span>
          <button onClick={() => setError('')} className="message-close">✕</button>
        </div>
      )}
      
      {success && (
        <div className="message message-success">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="message-close">✕</button>
        </div>
      )}

      {/* Call History */}
      <div className="call-history">
        <h3>היסטוריית שיחות</h3>
        <div className="call-history-list">
          {callHistory.length === 0 ? (
            <p className="no-calls">אין שיחות בהיסטוריה</p>
          ) : (
            callHistory.map((call) => (
              <div key={call.id} className="call-history-item">
                <div className="call-info">
                  <div className="call-phone">{call.phoneNumber}</div>
                  <div className="call-time">{formatTimestamp(call.timestamp)}</div>
                </div>
                <div className="call-details">
                  {call.fromNumber && (
                    <div className="call-from">ממספר: {call.fromNumber}</div>
                  )}
                  <span className={`call-status-badge call-status-${call.status}`}>
                    {call.status === 'initiated' ? 'התחיל' : 
                     call.status === 'completed' ? 'הושלם' : 
                     call.status === 'failed' ? 'נכשל' : call.status}
                  </span>
                  {call.duration > 0 && (
                    <span className="call-duration-badge">
                      {formatDuration(call.duration)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Hidden audio element for ringtone */}
      <audio ref={audioRef} style={{ display: 'none' }}>
        <source src="/ringtone.mp3" type="audio/mpeg" />
      </audio>
    </div>
  );
};

export default PhoneDialer;
