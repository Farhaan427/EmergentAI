import { useState, useRef, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Upload, Camera, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Home = () => {
  const canvasRef = useRef(null);
  const webcamRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [compareText, setCompareText] = useState("");
  const [compareResult, setCompareResult] = useState(null);
  const [webcamStream, setWebcamStream] = useState(null);
  const [activeTab, setActiveTab] = useState("draw");

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  // Fetch history
  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/history`);
      setHistory(response.data.slice(0, 10));
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Canvas drawing functions
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setRecognitionResult(null);
    setCompareResult(null);
  };

  // Recognition function
  const recognizeCanvas = async () => {
    const canvas = canvasRef.current;
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/recognize`, {
        image_base64: base64Image,
        source: 'canvas'
      });
      setRecognitionResult(response.data);
      toast.success('Recognition complete!');
      fetchHistory();
    } catch (error) {
      console.error('Recognition error:', error);
      toast.error('Recognition failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Upload image
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await axios.post(`${API}/recognize/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setRecognitionResult(response.data);
      toast.success('Image recognized!');
      fetchHistory();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Webcam functions
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = webcamRef.current;
      video.srcObject = stream;
      video.play();
      setWebcamStream(stream);
      toast.success('Webcam started');
    } catch (error) {
      console.error('Webcam error:', error);
      toast.error('Could not access webcam');
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
  };

  const captureWebcam = async () => {
    const video = webcamRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/recognize`, {
        image_base64: base64Image,
        source: 'webcam'
      });
      setRecognitionResult(response.data);
      toast.success('Image captured and recognized!');
      fetchHistory();
    } catch (error) {
      console.error('Capture error:', error);
      toast.error('Recognition failed');
    } finally {
      setLoading(false);
    }
  };

  // Compare function
  const handleCompare = async () => {
    if (!recognitionResult || !compareText) {
      toast.error('Please provide both predicted and expected text');
      return;
    }

    try {
      const response = await axios.post(`${API}/compare`, {
        predicted_text: recognitionResult.recognized_text,
        expected_text: compareText
      });
      setCompareResult(response.data);
    } catch (error) {
      console.error('Compare error:', error);
      toast.error('Comparison failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 relative">
          <div className="inline-block relative">
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-rose-600 to-orange-600 mb-3 animate-gradient" style={{fontFamily: 'Playfair Display, serif'}}>
              SketchReader
            </h1>
            <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-rose-400 to-orange-400 rounded-full opacity-60"></div>
          </div>
          <p className="text-base sm:text-lg text-gray-700 mt-6 font-medium tracking-wide" style={{fontFamily: 'Inter, sans-serif'}}>
            Transform Handwriting into Digital Text
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Recognition Area */}
          <div className="lg:col-span-2">
            <Card className="backdrop-blur-xl bg-white/80 shadow-2xl border border-white/40 rounded-3xl overflow-hidden hover:shadow-3xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-orange-500/10 border-b border-gray-100/50">
                <CardTitle className="text-3xl font-semibold text-gray-800" style={{fontFamily: 'Playfair Display, serif'}}>Recognition Studio</CardTitle>
                <CardDescription className="text-base">Draw, upload, or capture handwritten text</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-8 bg-gradient-to-r from-amber-100 via-rose-100 to-orange-100 p-1.5 rounded-2xl">
                    <TabsTrigger value="draw" data-testid="tab-draw" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-300">
                      <Pencil className="w-4 h-4 mr-2" />
                      Draw
                    </TabsTrigger>
                    <TabsTrigger value="upload" data-testid="tab-upload" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-300">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </TabsTrigger>
                    <TabsTrigger value="webcam" data-testid="tab-webcam" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-300">
                      <Camera className="w-4 h-4 mr-2" />
                      Webcam
                    </TabsTrigger>
                  </TabsList>

                  {/* Draw Tab */}
                  <TabsContent value="draw" data-testid="draw-panel">
                    <div className="space-y-6">
                      <div className="relative group">
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={300}
                          className="border-3 border-gray-200 rounded-2xl w-full cursor-crosshair bg-white shadow-inner hover:shadow-xl transition-shadow duration-300"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          data-testid="drawing-canvas"
                        />
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-gray-600 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                          Draw here ✍️
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button 
                          onClick={recognizeCanvas} 
                          disabled={loading} 
                          className="flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-orange-500 hover:from-amber-600 hover:via-rose-600 hover:to-orange-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300" 
                          data-testid="recognize-canvas-btn"
                        >
                          {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Recognizing...</> : 'Recognize Handwriting'}
                        </Button>
                        <Button 
                          onClick={clearCanvas} 
                          variant="outline" 
                          className="h-12 px-6 rounded-xl border-2 border-gray-300 hover:border-rose-400 hover:bg-rose-50 transition-all duration-300" 
                          data-testid="clear-canvas-btn"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Upload Tab */}
                  <TabsContent value="upload" data-testid="upload-panel">
                    <div className="space-y-4">
                      <div className="relative border-3 border-dashed border-amber-300 rounded-2xl p-16 text-center bg-gradient-to-br from-amber-50/50 to-orange-50/50 hover:from-amber-100/50 hover:to-orange-100/50 transition-all duration-300 group">
                        <Upload className="w-16 h-16 mx-auto mb-6 text-amber-500 group-hover:scale-110 transition-transform duration-300" />
                        <Label htmlFor="file-upload" className="cursor-pointer block">
                          <span className="text-lg font-semibold text-amber-600 hover:text-amber-700">Choose a file</span>
                          <span className="block text-gray-600 mt-2">or drag and drop</span>
                          <span className="block text-sm text-gray-500 mt-3">PNG, JPG, JPEG up to 10MB</span>
                        </Label>
                        <Input
                          id="file-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={loading}
                          data-testid="file-upload-input"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Webcam Tab */}
                  <TabsContent value="webcam" data-testid="webcam-panel">
                    <div className="space-y-6">
                      <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black">
                        <video
                          ref={webcamRef}
                          className="w-full rounded-2xl"
                          style={{maxHeight: '300px', objectFit: 'cover'}}
                          data-testid="webcam-video"
                        />
                        {!webcamStream && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
                            <div className="text-center">
                              <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                              <p className="text-gray-300">Webcam not started</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        {!webcamStream ? (
                          <Button 
                            onClick={startWebcam} 
                            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300" 
                            data-testid="start-webcam-btn"
                          >
                            <Camera className="mr-2 h-5 w-5" />
                            Start Webcam
                          </Button>
                        ) : (
                          <>
                            <Button 
                              onClick={captureWebcam} 
                              disabled={loading} 
                              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-orange-500 hover:from-amber-600 hover:via-rose-600 hover:to-orange-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300" 
                              data-testid="capture-webcam-btn"
                            >
                              {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Processing...</> : 'Capture & Recognize'}
                            </Button>
                            <Button 
                              onClick={stopWebcam} 
                              variant="outline" 
                              className="h-12 px-6 rounded-xl border-2 border-gray-300 hover:border-red-400 hover:bg-red-50 transition-all duration-300" 
                              data-testid="stop-webcam-btn"
                            >
                              Stop
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Recognition Result */}
                {recognitionResult && (
                  <Card className="mt-8 bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50 border-2 border-amber-200/50 rounded-2xl shadow-xl animate-fadeIn" data-testid="recognition-result">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-600" />
                          Recognition Result
                        </span>
                        <Badge 
                          variant={recognitionResult.confidence === 'high' ? 'default' : 'secondary'} 
                          className={recognitionResult.confidence === 'high' ? 'bg-green-500 hover:bg-green-600 text-white px-4 py-1.5' : 'px-4 py-1.5'}
                          data-testid="confidence-badge"
                        >
                          {recognitionResult.confidence} confidence
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-white rounded-xl p-6 shadow-md mb-4">
                        <p className="text-3xl font-bold text-gray-800 leading-relaxed" data-testid="recognized-text" style={{fontFamily: 'Playfair Display, serif'}}>
                          "{recognitionResult.recognized_text}"
                        </p>
                      </div>
                      
                      {/* Compare Section */}
                      <div className="space-y-4 mt-6 pt-6 border-t-2 border-gray-200/50">
                        <Label htmlFor="compare-input" className="text-base font-semibold text-gray-700">Compare with expected text:</Label>
                        <div className="flex gap-3">
                          <Input
                            id="compare-input"
                            placeholder="Enter expected text..."
                            value={compareText}
                            onChange={(e) => setCompareText(e.target.value)}
                            className="h-12 rounded-xl border-2 border-gray-200 focus:border-amber-400 transition-colors"
                            data-testid="compare-input"
                          />
                          <Button 
                            onClick={handleCompare} 
                            className="h-12 px-8 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300" 
                            data-testid="compare-btn"
                          >
                            Compare
                          </Button>
                        </div>
                        {compareResult && (
                          <div className="mt-4 p-6 bg-white rounded-xl shadow-md animate-fadeIn" data-testid="compare-result">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`p-2 rounded-full ${compareResult.match_percentage === 100 ? 'bg-green-100' : 'bg-orange-100'}`}>
                                {compareResult.match_percentage === 100 ? (
                                  <Check className="w-6 h-6 text-green-600" />
                                ) : (
                                  <X className="w-6 h-6 text-orange-600" />
                                )}
                              </div>
                              <span className="text-2xl font-bold text-gray-800" data-testid="match-percentage">
                                {compareResult.match_percentage}% Match
                              </span>
                            </div>
                            <p className="text-base text-gray-600 leading-relaxed" data-testid="match-analysis">{compareResult.analysis}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>

          {/* History Sidebar */}
          <div className="lg:col-span-1">
            <Card className="backdrop-blur-sm bg-white/90 shadow-xl border-0">
              <CardHeader>
                <CardTitle className="text-xl" style={{fontFamily: 'Space Grotesk, sans-serif'}}>Recent History</CardTitle>
                <CardDescription>Your recognition history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="history-list">
                  {history.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No history yet</p>
                  ) : (
                    history.map((item, index) => (
                      <div key={item.id || index} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" data-testid={`history-item-${index}`}>
                        <div className="flex items-start justify-between mb-1">
                          <Badge variant="outline" className="text-xs" data-testid={`history-source-${index}`}>{item.source}</Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate" data-testid={`history-text-${index}`}>
                          {item.recognized_text}
                        </p>
                        {item.confidence && (
                          <p className="text-xs text-gray-500 mt-1">Confidence: {item.confidence}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;