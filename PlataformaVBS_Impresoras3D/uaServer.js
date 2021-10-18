/*--- IMPORTACION DE MODULOS --- */

const { OPCUAServer,DataType,nodesets,
    StatusCodes,Variant,standardUnits} = require("node-opcua");
const chalk = require("chalk");
const SerialPort = require('serialport');
// const raspi = require('raspi');
// const I2C = require('raspi-i2c').I2C;


/* --- VARIABLES GLOBALES --- */

Tb = ''; Te = '';   
P = ''; I = ''; D = ''; S = ''; T = ''    // PID hottend 
// Parametros
Df = ''; PasosE = ''; PasosX = ''; PasosY = ''; PasosZ = ''; 
VmaxX = ''; VmaxY = ''; VmaxZ = ''; VmaxE = ''; AmaxE = ''; 
AmaxX = ''; AmaxY = ''; AmaxZ = ''; errImp = ''; Pm = '';
const I4AAS = "Opc.Ua.I4AAS.NodeSet2.xml";


/* --- ACCESO DE USUARIOS --- */

const userManager = {
    isValidUser: function(userName, password) {
        if (userName === "julian" && password === "1234") {return true;}
        if (userName === "user2" && password === "clave") {return true;}
        return false;}
    };


/* --- SERVIDOR UA ASINCRONO --- */

(async () => {
    try {
        /* --- PARAMETROS DEL SERVIDOR --- */

        const server = new OPCUAServer({
            nodeset_filename: [
                nodesets.standard,
                I4AAS,
                nodesets.cnc,
                nodesets.di,
                nodesets.machinery],   
            serverInfo: {applicationName: { 
                text: "Servidor ImpresoraFDM", 
                locale: "ES" }
            },
            userManager: userManager, 
            port: 4334, resourcePath: "/UA/ImpresoraServer",   
            buildInfo : {
                productName: "ServidorImpresorasFDM", 
                buildNumber: "7658", buildDate: new Date(2021,1,16)
            }
        });


        /* --- DEFINICION DEL ESPACIO DE DIRECCIONES ---*/

        await server.initialize();
        const addressSpace = server.engine.addressSpace;    // generar addressSpace inicial
        const namespace = addressSpace.getOwnNamespace("http://opcfoundation.org/UA/");   // Mi namespace(ns) 
        const nsAAS = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/I4AAS/");  
        const nsCnc = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CNC");      
        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        const nsMachinery = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/");


        /* --- BUSCAR OBJECTYPES A INSTANCIAR --- */

        /* --- Cnc ObjectTypes ---*/
        const CncInterfaceType = addressSpace.findObjectType("CncInterfaceType",nsCnc);
        const CncAxisType = addressSpace.findObjectType("CncAxisType",nsCnc);
        const CncChannelType = addressSpace.findObjectType("CncChannelType",nsCnc);
        const CncSpindleType = addressSpace.findObjectType("CncSpindleType",nsCnc);
        const CncMessageType = addressSpace.findObjectType("CncMessageType",nsCnc);
        /* --- I4AAS ObjectTypes ---*/
        const AASAssetAdministrationShellType = addressSpace.findObjectType("AASAssetAdministrationShellType",nsAAS);
        const AASReferenceType = addressSpace.findObjectType("AASReferenceType",nsAAS);
        const AASSubmodelType = addressSpace.findObjectType("AASSubmodelType",nsAAS);
        const AASConceptDictionaryType = addressSpace.findObjectType("AASConceptDictionaryType",nsAAS);
        const IAASIdentifiableType = addressSpace.findObjectType("IAASIdentifiableType",nsAAS);
        const AASIdentifierType = addressSpace.findObjectType("AASIdentifierType",nsAAS);
        const AASFileType = addressSpace.findObjectType("AASFileType",nsAAS);
        const AASSubmodelElementCollectionType = addressSpace.findObjectType("AASSubmodelElementCollectionType",nsAAS);
        const AASPropertyType = addressSpace.findObjectType("AASPropertyType",nsAAS);
        const AASIrdiConceptDescriptionType = addressSpace.findObjectType('AASIrdiConceptDescriptionType',nsAAS);
        const AASDataSpecificationIEC61360Type = addressSpace.findObjectType('AASDataSpecificationIEC61360Type',nsAAS);
        const AASAdministrativeInformationType = addressSpace.findObjectType('AASAdministrativeInformationType',nsAAS);
        const FileType = addressSpace.findObjectType("FileType", 0);
        /* --- DI y Machinary Types ---*/
        const ComponentType = addressSpace.findObjectType("ComponentType",nsDI);
        const machineIdentificationType = addressSpace.findObjectType("MachineIdentificationType", nsMachinery);

        
        /* --- ESPACIO PARA INSTANCIAR, CREAR Y MAPEAR (OBJETOS, VARIABLES, METODOS) --- */    
        

        /* --- MODELACION DEL AAS ---*/
        const AASROOT = namespace.addFolder(addressSpace.rootFolder.objects,{
            browseName: "AASROOT"
        });
        const AAS = AASAssetAdministrationShellType.instantiate({
            browseName: "Impresora3dPRUSA",
            organizedBy: AASROOT,
            optionals:["DerivedFrom"]
        });
        const AAS_Id= AASIdentifierType.instantiate({
            browseName: "identification",
            componentOf: AAS
        });
        const administration = AASAdministrativeInformationType.instantiate({
            browseName: "administration",
            componentOf: AAS,
            optionals: ["Version","Revision"]
        });
        AAS.addReference({referenceType: "HasInterface", nodeId: IAASIdentifiableType});
        /* --- MAPEO ---*/
        AAS_Id.id.setValueFromSource({dataType: "String", 
            value: "https://www.univalle.edu.co/eime/aas/1/1/AAS-3DPrinter"
        });
        AAS_Id.idType.setValueFromSource({dataType: "Int32", value:1});
        administration.version.setValueFromSource({dataType: "String", value: "1"});
        administration.revision.setValueFromSource({dataType: "String", value: "1"});


        /* --- MODELACION DEL CONCEPTDICTIONARY ---*/
        const AASConceptDictionary = AASConceptDictionaryType.instantiate({
            browseName: "ConceptDictionary",
            componentOf: AAS,
        });
        const DfilamentoDicc = AASIrdiConceptDescriptionType.instantiate({
            browseName: "0173-1#01-AKH746#018",
            componentOf: AASConceptDictionary
        });


        /* --- MODELACION DEL ASSET ---*/
        const AssetId = AASIdentifierType.instantiate({
            browseName: "identification",
            componentOf: AAS.asset.nodeId
        });
        const AssetIdentificationModel = AASReferenceType.instantiate({
            browseName: "AssetIdentificationModel",
            componentOf: AAS.asset.nodeId
        });
        /* --- MAPEO ---*/
        AssetId.id.setValueFromSource({dataType: "String", 
            value: "https://impresoras3dcolombia.co/IP3DPRUSA"
        });
        AssetId.idType.setValueFromSource({dataType: "Int32", value:1});
        AAS.asset.assetKind.setValueFromSource({dataType: "Int32", value:1});   
        AAS.asset.assetIdentificationModel.keys.setValueFromSource({dataType: "String",
            value: "(Submodel)[IRI]https://impresoras3dcolombia.co/IP3DPRUSA"    
        });


        /* --- MODELACION DEL SUBMODELO DE IDENTIFICACION ---*/
        const SM_Identification = AASSubmodelType.instantiate({
            browseName: "SubmodelIdentification",
            componentOf: AAS
        });
        const SM_IdentificationId = AASIdentifierType.instantiate({
            browseName: "identification",
            componentOf: SM_Identification
        });
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.assetId.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.manufacturer.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.manufacturerUri.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: machineIdentificationType.location.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.model.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.hardwareRevision.clone()});
        SM_Identification.addReference({referenceType: "HasProperty", nodeId: ComponentType.softwareRevision.clone()});
        // AASSubmodelID.addReference({referenceType: "HasProperty", nodeId: machineIdentificationType.yearOfConstruction.clone()})
        /* --- Establecer referencia no jerarquica con el AssetIdentificationModel ---*/
        AssetIdentificationModel.addReference({referenceType: "ns=2;i=4003", nodeId: SM_Identification});
        /* --- MAPEO ---*/
        SM_Identification.assetId.setValueFromSource({dataType: "String", value: "IP3DPRUSA"});
        SM_Identification.manufacturer.setValueFromSource({dataType:DataType.LocalizedText,value:[{locale: "es", text: " IP3D"}]});
        SM_Identification.manufacturerUri.setValueFromSource({dataType: "String", value: "https://impresoras3dcolombia.co/"});
        SM_Identification.location.setValueFromSource({dataType: "String", value: "Cali, Colombia"});
        SM_Identification.model.setValueFromSource({dataType: DataType.LocalizedText, value: [{locale: "es", text: " Xmodelo"}]});
        SM_Identification.hardwareRevision.setValueFromSource({dataType: "String", value: "n"});
        SM_Identification.softwareRevision.setValueFromSource({dataType: "String", value: "n"});
        SM_IdentificationId.id.setValueFromSource({dataType:"String",value:" https://impresoras3dcolombia.co/IP3DPRUSA"});
        SM_IdentificationId.idType.setValueFromSource({dataType:"Int32",value: 1});
        SM_Identification.modelingKind.setValueFromSource({dataType:"Int32",value: 1});
        

        /* --- MODELACION DEL SUBMODELO DE DOCUMENTOS ---*/
        const SMDocuments = AASSubmodelType.instantiate({
            browseName: "SubmodelDocuments",
            componentOf: AAS,
        });
        const SMDocumentsId = AASIdentifierType.instantiate({
            browseName: "identification",
            componentOf: SMDocuments
        });
        const OperationManual = AASSubmodelElementCollectionType.instantiate({
            browseName: "OperationManual",
            componentOf: SMDocuments,
            optionals:["AllowDuplicates"]
        });
        const AASfile = AASFileType.instantiate({
            browseName: "DigitalFile_PDF",
            componentOf: OperationManual
        });
        const File = FileType.instantiate({
            browseName: "File",
            componentOf: AASfile
        });
        /* --- MAPEO ---*/
        AASfile.value.setValueFromSource({ dataType: "String", value: "creality-ender-3-3d-printer-manual.pdf"});
        AASfile.mimeType.setValueFromSource({ dataType: "String", value: "application/pdf"});
        File.size.setValueFromSource({dataType: "UInt64", value: 828480});
        SMDocumentsId.id.setValueFromSource({dataType:"String",value:" url segun normativas"});
        SMDocumentsId.idType.setValueFromSource({dataType:"Int32",value: 1});


        /* --- MODELACION DEL SUBMODELO OPERATIONAL DATA ---*/
        addressSpace.installAlarmsAndConditionsService();
        const SMOperational = AASSubmodelType.instantiate({
            browseName: "SubmodelOperationalData",
            componentOf: AAS
        });
        const SMOperationalId = AASIdentifierType.instantiate({
            browseName: "identification",
            componentOf: SMOperational
        });
        const CncInterface = CncInterfaceType.instantiate({
            browseName: "CncInterface",
            componentOf: SMOperational,
        });  
        const CncChannel = CncChannelType.instantiate({
            browseName: "Channel 1",
            eventNotifier: 0x01,
            componentOf: CncInterface.cncChannelList.nodeId
        });
        const CncSpindle = CncSpindleType.instantiate({
            browseName: "Extrusor",
            componentOf: CncInterface.cncSpindleList.nodeId
        });
        const CncAxisExtrusor = CncAxisType.instantiate({
            browseName: "E",
            componentOf: CncInterface.cncAxisList.nodeId
        });
        const CncAxisX = CncAxisType.instantiate({
            browseName: "X",
            componentOf: CncInterface.cncAxisList.nodeId
        });
        const CncAxisY = CncAxisType.instantiate({
            browseName: "Y[B]",
            componentOf: CncInterface.cncAxisList.nodeId
        });
        const CncAxisZ = CncAxisType.instantiate({
            browseName: "Z",
            componentOf: CncInterface.cncAxisList.nodeId
        });
        /* --- CREAR VARIABLES --- */
        const TempBase = namespace.addAnalogDataItem({
            componentOf: CncAxisY,
            browseName: "TemperaturaBaseCaliente",
            definition: "Temperatura de la base caliente",
            valuePrecision: 0.01,
            engineeringUnitsRange: { low: 100, high: 200 },
            instrumentRange: { low: -100, high: +200 },
            engineeringUnits: standardUnits.degree_celsius,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: Tb+S})
            },
        });
        const TempExtr = namespace.addAnalogDataItem({
            componentOf: CncSpindle,
            browseName: "TempExtrusor",
            definition: "Temperatura del extrusor",
            valuePrecision: 0.01,
            engineeringUnitsRange: { low: 100, high: 200 },
            instrumentRange: { low: -100, high: +200 },
            engineeringUnits: standardUnits.degree_celsius,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: Te+S})
            },
        });
        const CncMessage = CncMessageType.instantiate({
            browseName: "CncMessage",
            notifierOf: addressSpace.rootFolder.objects.server,
            organizedBy: SMOperational
        });
        const Error = namespace.addVariable({
            browseName: "Error",
            componentOf: CncChannel,
            eventSourceOf: CncChannel,
            dataType: "String",
            value: {
                get: () => new Variant({ dataType: DataType.String, value: errImp+T})
            }
        });
        CncChannel.addReference({referenceType: "Organizes", nodeId:CncAxisExtrusor});
        CncChannel.addReference({referenceType: "Organizes", nodeId:CncAxisX});
        CncChannel.addReference({referenceType: "Organizes", nodeId:CncAxisY});
        CncChannel.addReference({referenceType: "Organizes", nodeId:CncAxisZ});
        CncChannel.addReference({referenceType: "Organizes", nodeId:CncSpindle});
        CncChannel.addReference({referenceType: "GeneratesEvent",nodeId:CncMessage});
        
        /* --- CREAR METODOS ---*/
        const method = namespace.addMethod(SMOperational,{
            browseName: "Write Serial",
            inputArguments:  [
                {
                    name:"Gcode, Mcode",
                    description: { text: "Escribir codigo a enviar" },
                    dataType: DataType.String
                }
            ],
            outputArguments: [{
                name:"Confirmacion",
                description:{ text: "Confirmar envio" },
                dataType: DataType.String ,
            }]
        });
        method.bindMethod((inputArguments,context,callback) => {
            const inCode =  inputArguments[0].value;
            port.write(inCode);
            const callMethodResult = {
                statusCode: StatusCodes.Good,
                outputArguments: [{
                        dataType: DataType.String,
                        value : "Codigo enviado"
                }]
            };
            callback(null,callMethodResult);
            console.log(inCode);
        });
        /* --- MAPEO ---*/
        CncMessage.sourceNode.setValueFromSource({dataType: "NodeId",value: CncChannel.error.nodeId});
        CncMessage.eventType.setValueFromSource({dataType: "NodeId",value: CncMessageType.nodeId});
        CncMessage.sourceName.setValueFromSource({dataType: "String",value: "Mensaje de error"});
        CncMessage.eventId.setValueFromSource({dataType: "String", value: "Interrupt errors"});
        setInterval(()=>{
            CncMessage.message.setValueFromSource({dataType: DataType.LocalizedText,value:{locale:"en",text: errImp+T}})
        },5000);
        SMOperationalId.id.setValueFromSource({dataType:"String",value:" url segun normativas"});
        SMOperationalId.idType.setValueFromSource({dataType:"Int32",value: 1});
        SMOperational.modelingKind.setValueFromSource({dataType:"Int32",value: 1});
        

        /* --- MODELACION DEL SUBMODELO TECHNICAL DATA ---*/
        const SMTechnical = AASSubmodelType.instantiate({
            browseName: "SubmodelTechnicalData",
            componentOf: AAS
        });
        const SMTechnicalId = AASIdentifierType.instantiate({
            browseName: "identification",
            componentOf: SMTechnical
        });
        const Dfilamento = AASPropertyType.instantiate({
            browseName: "DiametroFilamento",
            componentOf: SMTechnical,
            optionals: ["Value"]
        });
        Dfilamento.addReference({referenceType:"HasDictionaryEntry",nodeId: DfilamentoDicc});
        Dfilamento.valueType.setValueFromSource({dataType: "Int32",value: 10});
        Dfilamento.modelingKind.setValueFromSource({dataType: "Int32",value: 1});
        Dfilamento.category.setValueFromSource({dataType: "String",value: "Parametro"});
        Dfilamento.value.setValueFromSource({dataType: "Double",value: Df});    //meter en un setInterval
        const DataSpecification = AASDataSpecificationIEC61360Type.instantiate({
            browseName: "DataSpecification",
            componentOf: Dfilamento,
            optionals: ["Unit","Definition","DataType","Revision","Version"]
        });
        DataSpecification.identification.id.setValueFromSource({
            dataType: "String",
            value: "0112/2///61987#ABB961#001"
        });
        DataSpecification.identification.idType.setValueFromSource({
            dataType: "Int32",
            value: 0
        });
        DataSpecification.preferredName.setValueFromSource({
            dataType: DataType.LocalizedText,
            value: {locale:"EN",text:"size of orifice"}
        });
        DataSpecification.unit.setValueFromSource({
            dataType: "String",
            value: "mm"
        });
        DataSpecification.definition.setValueFromSource({
            dataType: DataType.LocalizedText,
            value:{locale:"EN",text:"internal diameter of a bore or orifice"}
        });
        DataSpecification.dataType.setValueFromSource({
            dataType: "Int32",
            value: 3
        });
        DfilamentoDicc.addReference({referenceType:"HasAddIn",nodeId:DataSpecification})
        
        const steps = namespace.addObject({
            browseName: "StepsUnit",
            description: "Pasos por unidad",
            componentOf: SMTechnical
        });
        const stepsX = namespace.addVariable({
            browseName: "stepsX",
            description: "Pasos por unidad eje x",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: PasosX})},
            componentOf: steps
        });
        const stepsY = namespace.addVariable({
            browseName: "stepsY",
            description: "Pasos por unidad eje y",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: PasosY})},
            componentOf: steps
        });
        const stepsZ = namespace.addVariable({
            browseName: "stepsZ",
            description: "Pasos por unidad eje z",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: PasosZ})},
            componentOf: steps
        });
        const stepsE = namespace.addVariable({
            browseName: "stepsE",
            description: "Pasos por unidad eje E",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: PasosE})},
            componentOf: steps
        });
        const MaxFeedrates = namespace.addObject({
            browseName: "MaxFeedrates",
            description: "Velocidad máxima de avance",
            componentOf: SMTechnical
        });
        const MaxFeedratesX = namespace.addVariable({
            browseName: "MaxFeedratesX",
            description: "Velocidad máxima de avance eje X",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: VmaxX})},
            componentOf: MaxFeedrates
        });
        const MaxFeedratesY = namespace.addVariable({
            browseName: "MaxFeedratesY",
            description: "Velocidad máxima de avance eje Y",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: VmaxY})},
            componentOf: MaxFeedrates
        });
        const MaxFeedratesZ = namespace.addVariable({
            browseName: "MaxFeedratesZ",
            description: "Velocidad máxima de avance eje Z",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: VmaxZ})},
            componentOf: MaxFeedrates
        });
        const MaxFeedratesE = namespace.addVariable({
            browseName: "MaxFeedratesE",
            description: "Velocidad máxima de avance eje E",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: VmaxE})},
            componentOf: MaxFeedrates
        });
        const MaxAceleracion = namespace.addObject({
            browseName: "MaxAceleracion",
            description: "Aceleración máxima",
            componentOf: SMTechnical
        });
        const MaxAceleracionX = namespace.addVariable({
            browseName: "MaxAceleracionX",
            description: "Aceleración máxima eje X",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: AmaxX})},
            componentOf: MaxAceleracion
        });
        const MaxAceleracionY = namespace.addVariable({
            browseName: "MaxAceleracionY",
            description: "Aceleración máxima eje Y",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: AmaxY})},
            componentOf: MaxAceleracion
        });
        const MaxAceleracionZ = namespace.addVariable({
            browseName: "MaxAceleracionZ",
            description: "Aceleración máxima eje Z",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: AmaxZ})},
            componentOf: MaxAceleracion
        });
        const MaxAceleracionE = namespace.addVariable({
            browseName: "MaxAceleracionE",
            description: "Aceleración máxima eje E",
            dataType: "Double",
            value: {get: () => new Variant({ dataType: DataType.Double, value: AmaxE})},
            componentOf: MaxAceleracion
        });
        const DefaultPLA = namespace.addVariable({
            browseName: "DefaultPLA",
            description: "Parametros por defecto para impresion con PLA",
            dataType: "Double",
            componentOf: SMTechnical
        });
        const PID_Hottend = namespace.addObject({
            browseName: "PID_Hottend",
            description: "Parametros PID por defecto para hottend",
            componentOf: SMTechnical
        });
        const P_Hottend = namespace.addVariable({
            browseName: "P",
            description: "Valor proporcional",
            componentOf: PID_Hottend,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: P+Pm})
            }
        })
        const I_Hottend = namespace.addVariable({
            browseName: "I",
            description: "Valor integral",
            componentOf: PID_Hottend,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: I+Pm})
            }
        })
        const D_Hottend = namespace.addVariable({
            browseName: "D",
            description: "Valor derivado",
            componentOf: PID_Hottend,
            dataType: "Double",
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: D+Pm})
            }
        })
        /* --- MAPEO ---*/
        SMTechnicalId.id.setValueFromSource({dataType:"String",value:" url segun normativas"});
        SMTechnicalId.idType.setValueFromSource({dataType:"Int32",value: 1});
        SMTechnical.modelingKind.setValueFromSource({dataType:"Int32",value: 1});


        /* --- BORRAR NODOS NO UTILIZADOS ---*/
        addressSpace.deleteNode(addressSpace.rootFolder.objects.deviceSet)
        addressSpace.deleteNode(addressSpace.rootFolder.objects.deviceTopology)
        addressSpace.deleteNode(addressSpace.rootFolder.objects.machines)
        addressSpace.deleteNode(addressSpace.rootFolder.objects.networkSet)
        addressSpace.deleteNode(addressSpace.rootFolder.objects.test)
        

        /* --- ESPERAR CONFIGURACION DEL SERVIDOR PARA COMENZAR A EXPONERSE ---*/

        await server.start();
        const endpointUrl = server.getEndpointUrl();  // obtener informacion del punto de acceso

        /* --- MOSTRAR INFORMACION DEL SERVIDOR --- */

        console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));
        console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

        /* --- PROCESO DE SALIDA O PARADA DEL SERVIDOR --- */

        process.on("SIGINT", async () => {
            // only work on linux apparently
            await server.shutdown(1000);
            console.log(chalk.red.bold(" shutting down completed "));
            process.exit(-1);
        });
    }
    catch(err){
        /* --- CODIGO DE EJECUCION SI OCURRE UN ERROR EN EL BLOQUE TRY --- */

        console.log(chalk.bgRed.white("Error" + err.message));
        console.log(err);
        process.exit(-1);
    }
})();



/* --- APP COMUNICACION SERIAL ---*/

const port = new SerialPort(
    "COM3",
    {baudRate: 115200}
)

const parser = new SerialPort.parsers.Readline()

port.pipe(parser)

parser.on('data', (line)=>{
    if(line.search('echo') != -1){
        if(line.search('G21 ') != -1){      // Unidades en [mm]
            unit = 'mm'
            // console.log('unidades en',unit);
        }
        else if(line.search('G20 ') != -1){      // Unidades en [in]
            unit = 'in'
            // console.log('unidades en',unit);
        }
        else if(line.search('M149') != -1){      // unidades de las temperaturas
            if(line.search('C') != -1){
                unitT = 'C'
                // console.log('Temperaturas en',unitT);
            }
            else if(line.search('F') != -1){
                unitT = 'F'
                // console.log('Temperaturas en',unitT);
            }
            else{
                unitT = 'K'
                // console.log('Temperaturas en',unitT);
            }
            
        }
        else if(line.search('M200') != -1){      // Diametro del filamento [unit] 
            Df = line.slice(line.search('D')+1,)
            // console.log('Df',Df);
        }
        else if(line.search('M92') != -1){      // Pasos por unidad [pasos/unit]
            PasosX = line.slice(line.search('X')+1,line.search('Y')-1);
            PasosY = line.slice(line.search('Y')+1,line.search('Z')-1);
            PasosZ = line.slice(line.search('Z')+1,line.search('E')-1);
            PasosE = line.slice(line.search('E')+1,);
            // console.log('PasosmmX',PasosmmX,'PasosmmY',PasosmmY,'PasosmmZ',PasosmmZ,'PasosmmE',PasosmmE);
        }   
        else if(line.search('M203') != -1){     // Velocidad maxima de avance [unit/s]
            VmaxX = line.slice(line.search('X')+1,line.search('Y')-1);
            VmaxY = line.slice(line.search('Y')+1,line.search('Z')-1);
            VmaxZ = line.slice(line.search('Z')+1,line.search('E')-1);
            VmaxE = line.slice(line.search('E')+1,);
            // console.log('VmaxX',VmaxX,'VmaxY',VmaxY,'VmaxZ',VmaxZ,'VmaxE',VmaxE);
        }
        else if(line.search('M201') != -1){     // Aceleracion maxima [unit/s2]
            AmaxX = line.slice(line.search('X')+1,line.search('Y')-1);
            AmaxY = line.slice(line.search('Y')+1,line.search('Z')-1);
            AmaxZ = line.slice(line.search('Z')+1,line.search('E')-1);
            AmaxE = line.slice(line.search('E')+1,);
            // console.log('AmaxX',AmaxX,'AmaxY',AmaxY,'AmaxZ',AmaxZ,'AmaxE',AmaxE);
        }
        else if(line.search('M204') != -1){     // Aceleraciones de impresion, retraccion y viaje [unit/s2]
            APrint = line.slice(line.search('P')+1,line.search('R')-1);
            Aretract = line.slice(line.search('R')+1,line.search('T')-1);
            Atravel = line.slice(line.search('T')+1,);
            // console.log('APrint',APrint,'Aretract',Aretract,'Atravel',Atravel);
        }
        else if(line.search('M301') != -1){     // Parametros PID
            P = line.slice(line.search('P')+1,line.search('I')-1);
            I = line.slice(line.search('I')+1,line.search('D')-1);
            D = line.slice(line.search('D')+1,);
            // console.log('P',P,'I',I,'D',D);
        }
        else if(line.search('Error') != -1){     // Mensaje de error impresora
            errImp = line;
            // console.log('error impresora',errImp,);
        }
    }
    else{
        Te = Number(line.slice(line.search('T')+2,line.search('/')-1));
        Tb = Number(line.slice(line.search('B')+2,line.search('@')-7));
        // console.log("Tb =",Tb);
        // console.log("Te =",Te);
    }
 
    console.log(line);
})


port.on('open', function(){
    console.log('puerto serial abierto');
});

port.on('err', function(err){
    console.log("Fallo con la conexion serial");
});

setTimeout(()=>{
    // port.write("G28\r\n");   // Mandar a home (comandos sin \r\n no funcionan )
    T = 'Prueba';
    Pm = 30*Math.random();
    // port.write("M155 S4\r\n");  // Pedir temperaturas cada 4 segundos (Evita errores en la impresion)
    // port.write("M115\r\n")      // Informacion del Firmware
},8000)


// setInterval(()=>{
//     port.write("M114 \r\n");   // Pedir posiciones 
//     // port.write("M105 \r\n");  // Pedir temperaturas
// },1000)

/* --- SIMULACION DE CAMBIO DE TEMPERATURAS POR SEGUNDO --- */
setInterval(() => {
    S = 60*Math.random()
    T = T+String(Math.random())
}, 10000);



/* --- Comunicacion I2C --- */

// raspi.init(() => {
//   const i2c = new I2C();
//   console.log(i2c.readByteSync(0x18)); // Read one byte from the device at address 18
// });              