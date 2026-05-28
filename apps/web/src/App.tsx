import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { InstructionBuilder } from "./pages/InstructionBuilder";
import { YamlWorkspace } from "./pages/YamlWorkspace";
import { AnalysisDashboard } from "./pages/AnalysisDashboard";
import { ScenarioPlayground } from "./pages/ScenarioPlayground";
import { Examples } from "./pages/Examples";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="builder" element={<InstructionBuilder />} />
        <Route path="workspace" element={<YamlWorkspace />} />
        <Route path="analysis" element={<AnalysisDashboard />} />
        <Route path="playground" element={<ScenarioPlayground />} />
        <Route path="examples" element={<Examples />} />
      </Route>
    </Routes>
  );
}
