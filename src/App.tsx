import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import AllInterviewsView from './components/AllInterviewsView';
import Header from './components/Header';
import { InterviewRunnerViewRoute } from './components/InterviewRunnerView';
import PublishInterviewView from './components/PublishedInterviewView';
import SingleInterviewView from './components/SingleInterviewView';
import InterviewService from './services/InterviewService';
import { AppState, AppDispatch, useAppReducer } from './store/appState';
import AuthProvider from './auth/AuthProvider';
import { ToastManager } from './components/ui/Toast';
import TermsOfUseView from './components/TermsOfUseView';
import PrivacyPolicyView from './components/PrivacyPolicyView';
import AboutPageView from './components/AboutPageView';
import LegalConfirmationModal from './components/LegalConfirmationModal';

const QUERY_CLIENT = new QueryClient();
const INTERVIEW_API_CLIENT = new InterviewService.API();

export default function App(): JSX.Element {
  const [globalState, dispatch] = useAppReducer();

  return (
    <AuthProvider>
      <QueryClientProvider client={QUERY_CLIENT}>
        <ToastManager>
          <AppState.Provider value={globalState}>
            <AppDispatch.Provider value={dispatch}>
              <div className="flex h-screen flex-col bg-gray-50 text-slate-900">
                <Header />
                <LegalConfirmationModal />
                <Routes>
                  <Route
                    path="/"
                    element={
                      <InterviewService.Provider client={INTERVIEW_API_CLIENT}>
                        <AllInterviewsView />
                      </InterviewService.Provider>
                    }
                  />
                  <Route path="/terms-of-use" element={<TermsOfUseView />} />
                  <Route
                    path="/privacy-policy"
                    element={<PrivacyPolicyView />}
                  />
                  <Route path="/about" element={<AboutPageView />} />

                  <Route
                    path="/interview/:interviewId/run"
                    element={
                      <InterviewService.Provider client={INTERVIEW_API_CLIENT}>
                        <InterviewRunnerViewRoute />
                      </InterviewService.Provider>
                    }
                  />
                  <Route
                    path="/interview/:interviewId/*"
                    element={
                      <InterviewService.Provider client={INTERVIEW_API_CLIENT}>
                        <SingleInterviewView />
                      </InterviewService.Provider>
                    }
                  />
                  <Route
                    path="/published/:vanityUrl/*"
                    element={
                      <InterviewService.Provider
                        pretendUserIsAuthenticated
                        client={INTERVIEW_API_CLIENT}
                      >
                        <PublishInterviewView />
                      </InterviewService.Provider>
                    }
                  />
                </Routes>
              </div>
            </AppDispatch.Provider>
          </AppState.Provider>
        </ToastManager>
      </QueryClientProvider>
    </AuthProvider>
  );
}
