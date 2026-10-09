import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Alert, AlertDescription } from "./ui/alert";
import { Database, Check, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "./Logo";
import { api } from "../lib/api";
import { isDemoUser as isDemoIdentity } from "../lib/session";
import { safeJsonParse, safeStorageGet } from "../lib/storage";

interface DatabaseForm {
  databaseType: string;
  host: string;
  port: string;
  databaseName: string;
  username: string;
  password: string;
  filePath?: string;
}

interface DatabaseConnectionPageProps {
  onComplete: () => void;
  onLogout?: () => void;
}

const databaseOptions = [
  {
    id: "mysql",
    name: "MySQL",
    badge: "MY",
    icon: "🐬",
    defaultPort: "3306",
    description: "Popular open-source relational database",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    badge: "PG",
    icon: "🐘",
    defaultPort: "5432",
    description: "Advanced open-source database system",
  },
  {
    id: "oracle",
    name: "Oracle",
    badge: "OR",
    icon: "🔴",
    defaultPort: "1521",
    description: "Enterprise-grade database solution",
  },
  {
    id: "sqlite",
    name: "SQLite",
    badge: "SQ",
    icon: "🪶",
    defaultPort: "",
    description: "Lightweight file-based database",
  },
];

const demoCredentials = {
  mysql: {
    host: "demo-mysql.orrico.cloud",
    port: "3306",
    databaseName: "retail_shop_demo",
    username: "demo_user",
    password: "demo_pass_2024",
  },
  postgresql: {
    host: "demo-postgres.orrico.cloud",
    port: "5432",
    databaseName: "retail_analytics",
    username: "demo_admin",
    password: "postgres_demo_2024",
  },
  oracle: {
    host: "demo-oracle.orrico.cloud",
    port: "1521",
    databaseName: "ORCL",
    username: "demo_retail",
    password: "oracle_demo_2024",
  },
  sqlite: {
    filePath: "demo_retail_shop.db",
    databaseName: "demo_retail_shop.db",
    host: "",
    port: "",
    username: "",
    password: "",
  },
};

export function DatabaseConnectionPage({
  onComplete,
  onLogout,
}: DatabaseConnectionPageProps) {
  const [selectedDatabase, setSelectedDatabase] = useState<string>("mysql");
  const [isLoading, setIsLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [existingConnection, setExistingConnection] = useState<any>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvTableName, setCsvTableName] = useState("");
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<{
    tableName: string;
    rowCount: number;
  } | null>(null);
  const currentUser = safeJsonParse<Record<string, unknown>>(
    safeStorageGet("orrico_current_user"),
    {},
  );
  const isDemoUser = isDemoIdentity(currentUser);

  const form = useForm<DatabaseForm>({
    defaultValues: {
      databaseType: "mysql",
      host: "localhost",
      port: "3306",
      databaseName: "",
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    api
      .currentDatabaseConnection()
      .then((result) => {
        setExistingConnection(result.connection);
        if (result.connection?.databaseType) {
          setSelectedDatabase(result.connection.databaseType);
          form.setValue("databaseType", result.connection.databaseType);
          form.setValue("databaseName", result.connection.databaseName || "");
          form.setValue("filePath", result.connection.filePath || "");
          form.setValue("host", result.connection.host || "");
          form.setValue("port", result.connection.port || "");
          form.setValue("username", result.connection.username || "");
        }
      })
      .catch(() => {
        setExistingConnection(null);
      });
  }, []);

  const handleDatabaseChange = (value: string) => {
    setSelectedDatabase(value);
    form.setValue("databaseType", value);
    
    const db = databaseOptions.find((db) => db.id === value);
    if (db?.defaultPort) {
      form.setValue("port", db.defaultPort);
    }
    
    form.setValue("host", "");
    form.setValue("databaseName", "");
    form.setValue("username", "");
    form.setValue("password", "");
  };

  const useDemoCredentials = () => {
    const demo = demoCredentials[selectedDatabase as keyof typeof demoCredentials];
    
    if (demo) {
      form.setValue("host", demo.host);
      form.setValue("port", demo.port);
      form.setValue("databaseName", demo.databaseName);
      form.setValue("username", demo.username);
      form.setValue("password", demo.password);
      
      if (selectedDatabase === "sqlite" && demo.filePath) {
        form.setValue("filePath", demo.filePath);
      }
      
      toast.success("Demo credentials loaded! You can now connect.");
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);

    try {
      const values = form.getValues();
      const result = await api.testDatabaseConnection({
        ...values,
        isDemoConnection: isDemoConnection(values),
      });

      toast.success(
        `Connection test successful. Found ${result.tableCount} tables.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Connection test failed.",
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const onSubmit = async (data: DatabaseForm) => {
    setIsLoading(true);

    try {
      const connectionConfig = {
        ...data,
        connectedAt: new Date().toISOString(),
        isDemoConnection: isDemoConnection(data),
      };

      const result = await api.saveDatabaseConnection(connectionConfig);
      setExistingConnection(result.connection);

      setIsLoading(false);
      toast.success("Database connected successfully! Redirecting to dashboard...");
      
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (error) {
      setIsLoading(false);
      toast.error(error instanceof Error ? error.message : "Connection failed. Please check your credentials.");
    }
  };

  const isDemoConnection = (data: DatabaseForm) => {
    const demo = demoCredentials[data.databaseType as keyof typeof demoCredentials];
    if (!demo) return false;

    if (data.databaseType === "sqlite") {
      return (
        (data.filePath || "") === (demo.filePath || "") &&
        data.databaseName === demo.databaseName
      );
    }
    
    return (
      data.host === demo.host &&
      data.port === demo.port &&
      data.databaseName === demo.databaseName &&
      data.username === demo.username &&
      data.password === demo.password
    );
  };

  const skipConnection = () => {
    if (!isDemoUser) {
      toast.error("Finish your new shop setup before continuing.");
      return;
    }

    toast.info("You can configure database connection later from settings.");
    onComplete();
  };

  const hasExistingConnection = existingConnection && !existingConnection.skipped;
  const selectedDatabaseOption = databaseOptions.find(
    (entry) => entry.id === selectedDatabase,
  );
  const isOracleSelected = selectedDatabase === "oracle";

  const proceedWithExisting = () => {
    toast.success("Using existing database connection...");
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  const importCsvFile = async () => {
    if (!csvFile) {
      toast.error("Select a CSV file first.");
      return;
    }
    if (csvFile.size > 1_500_000) {
      toast.error("Choose a CSV smaller than 1.5 MB.");
      return;
    }

    setIsImportingCsv(true);

    try {
      const csvContent = await csvFile.text();
      const result = await api.importCsvDataset({
        csvContent,
        fileName: csvFile.name,
        tableName: csvTableName,
      });

      setLastImportResult({
        tableName: result.tableName,
        rowCount: result.rowCount,
      });
      setCsvTableName(result.tableName);
      const current = await api.currentDatabaseConnection();
      setExistingConnection(current.connection);
      if (current.connection) {
        form.setValue("databaseName", current.connection.databaseName || "");
        form.setValue("filePath", current.connection.filePath || "");
        form.setValue("databaseType", current.connection.databaseType);
        setSelectedDatabase(current.connection.databaseType);
      }
      toast.success(
        `Imported ${result.rowCount} rows into ${result.tableName}. You can query it from chat now.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "CSV import failed.",
      );
    } finally {
      setIsImportingCsv(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo />
          {onLogout && (
            <Button variant="ghost" onClick={onLogout}>
              Logout
            </Button>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Database className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl">
              {isDemoUser
                ? `Welcome${hasExistingConnection ? " back" : ""}, ${currentUser.firstName}!`
                : `Set up your shop${hasExistingConnection ? "" : ""}, ${currentUser.firstName}!`}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {hasExistingConnection
                ? "You already have a database connection configured. You can continue with it or update the connection below."
                : isDemoUser
                  ? "This demo workspace stays separate from real accounts. Connect the demo source or continue exploring with the preloaded sample business."
                  : "This account starts fresh. Connect your own database or import shop data to activate chat, analytics, and dashboard workflows."
              }
            </p>
          </div>

          {hasExistingConnection && (
            <Alert className="bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Database already connected: </span>
                  <span className="text-muted-foreground">
                    {existingConnection.databaseType.toUpperCase()} - {existingConnection.databaseName}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={proceedWithExisting}
                  className="ml-4"
                >
                  Continue to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">
                {hasExistingConnection ? "Reconfigure Database Connection" : "Connect Your Database"}
              </CardTitle>
              <CardDescription>
                Select your database type and provide connection details to get
                started.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <Label>Select Database Type</Label>
                  <RadioGroup
                    value={selectedDatabase}
                    onValueChange={handleDatabaseChange}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {databaseOptions.map((db) => (
                      <div key={db.id} className="relative">
                        <RadioGroupItem
                          value={db.id}
                          id={db.id}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={db.id}
                          className="flex flex-col items-start gap-3 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-3 w-full">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-sm font-semibold tracking-wide">
                              {db.badge}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span>{db.name}</span>
                                {selectedDatabase === db.id && (
                                  <Check className="w-4 h-4 text-primary" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {db.description}
                              </p>
                            </div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {selectedDatabase !== "sqlite" && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Connection Details</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={useDemoCredentials}
                        className="gap-2"
                        disabled={!isDemoUser}
                      >
                        <Sparkles className="w-4 h-4" />
                        {isDemoUser
                          ? "Use Demo Credentials"
                          : "Demo Only"}
                      </Button>
                    </div>

                  <Alert className="border-sky-200 bg-sky-50/90">
                      <AlertDescription className="text-sm">
                        PostgreSQL and MySQL now support live connection testing
                        and schema inspection. Oracle remains a placeholder until
                        its driver path is added.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="host">Host</Label>
                        <Input
                          id="host"
                          placeholder="localhost ya server IP"
                          {...form.register("host", {
                            required: "Host is required",
                          })}
                        />
                        {form.formState.errors.host && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.host.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="port">Port</Label>
                        <Input
                          id="port"
                          placeholder="Default port"
                          {...form.register("port", {
                            required: "Port is required",
                          })}
                        />
                        {form.formState.errors.port && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.port.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="databaseName">Database Name</Label>
                      <Input
                        id="databaseName"
                        placeholder="Your database name"
                        {...form.register("databaseName", {
                          required: "Database name is required",
                        })}
                      />
                      {form.formState.errors.databaseName && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.databaseName.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          placeholder="Database username"
                          {...form.register("username", {
                            required: "Username is required",
                          })}
                        />
                        {form.formState.errors.username && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.username.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Database password"
                          {...form.register("password", {
                            required: "Password is required",
                          })}
                        />
                        {form.formState.errors.password && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.password.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={testConnection}
                      disabled={testingConnection || isOracleSelected}
                      className="w-full"
                    >
                      {isOracleSelected
                        ? "Oracle Connector Coming Next"
                        : testingConnection
                          ? `Testing ${selectedDatabaseOption?.name || "Connection"}...`
                          : `Test ${selectedDatabaseOption?.name || "Connection"}`}
                    </Button>
                  </div>
                )}

                {selectedDatabase === "sqlite" && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">SQLite Database</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={useDemoCredentials}
                        className="gap-2"
                        disabled={!isDemoUser}
                      >
                        <Sparkles className="w-4 h-4" />
                        {isDemoUser
                          ? "Use Demo Database"
                          : "Demo Only"}
                      </Button>
                    </div>

                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertDescription className="text-sm">
                        SQLite is the working connector right now. Use the demo
                        database or point to a local SQLite file to query real
                        data through chat.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label htmlFor="filePath">Database File Path</Label>
                      <Input
                        id="filePath"
                        placeholder="Path to your SQLite file or use the demo database"
                        {...form.register("filePath")}
                      />
                      <p className="text-sm text-muted-foreground">
                        Or upload your SQLite database file (.db, .sqlite, or .sqlite3)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sqliteFile">Upload Database File (Optional)</Label>
                      <Input
                        id="sqliteFile"
                        type="file"
                        accept=".db,.sqlite,.sqlite3"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            form.setValue("databaseName", file.name);
                            form.setValue("filePath", file.name);
                          }
                        }}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={testConnection}
                      disabled={testingConnection}
                      className="w-full"
                    >
                      {testingConnection
                        ? "Testing Connection..."
                        : "Test SQLite Connection"}
                    </Button>

                    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                      <div className="space-y-1">
                        <h4 className="font-medium">Import CSV Data</h4>
                        <p className="text-sm text-muted-foreground">
                          Upload business data as CSV and Aska will create a SQLite
                          table that chat can query directly.
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="csvTableName">Table Name</Label>
                          <Input
                            id="csvTableName"
                            placeholder="sales_april"
                            value={csvTableName}
                            onChange={(event) =>
                              setCsvTableName(event.target.value)
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="csvImportFile">CSV File</Label>
                          <Input
                            id="csvImportFile"
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(event) =>
                              setCsvFile(event.target.files?.[0] || null)
                            }
                          />
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={importCsvFile}
                        disabled={isImportingCsv}
                        className="w-full"
                      >
                        {isImportingCsv ? "Importing CSV..." : "Import CSV into SQLite"}
                      </Button>

                      {lastImportResult && (
                        <Alert className="bg-green-50 border-green-200">
                          <AlertDescription className="text-sm">
                            Imported <strong>{lastImportResult.rowCount}</strong> rows
                            into <strong>{lastImportResult.tableName}</strong>. Ask chat
                            about this table or inspect the schema to explore the data.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 gap-2"
                    disabled={isLoading || isOracleSelected}
                  >
                    {isOracleSelected
                      ? "Oracle Connector Coming Next"
                      : isLoading
                        ? "Connecting..."
                        : "Connect Database"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={skipConnection}
                    disabled={isLoading}
                  >
                    {isDemoUser ? "Skip for Now" : "Setup Required"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Your data is secure</h4>
                    <p className="text-sm text-muted-foreground">
                      Your database credentials are encrypted and stored securely.
                      We never access your data without your explicit permission.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-blue-900">
                      {isDemoUser ? "Demo Workspace" : "New Shop Setup"}
                    </h4>
                    <p className="text-sm text-blue-700">
                      {isDemoUser
                        ? "This lane stays on preloaded sample retail data so you can explore the product safely without touching live business records."
                        : "Real accounts begin with an empty shop setup. Connect your own source or import CSV data before using the live dashboard and chat."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
